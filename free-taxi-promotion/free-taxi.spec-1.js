import fs from 'fs';
import path from 'path';
import express from 'express';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import router from '@rides/router';
import nock from 'nock';
import DataModels from '@rides/data-models';
import MockDate from 'mockdate';
import moment from 'moment';

import featureToggleMiddleware from '../../../src/middleware/feature-toggles';
import trackingCookiesMiddleware from '../../../src/middleware/tracking-cookies';
import FreeTaxisController from '../../../src/controllers/free-taxis-controller';
import Tracking from '../../../src/services/tracking';
import cryptoUtil from '../../../src/utils/crypto';
import config from '../../../src/lib/config';
import redisClient from '../../../src/services/redis-client';
import KinesisStream from '../../../src/services/kinesis-stream';
import BookingEvent from '../../../src/models/stream-event/booking-meta';
import BkingExperimentEvent from '../../../src/models/stream-event/bkng-experiment-event';

jest.mock('../../../src/services/kinesis-stream');
jest.mock('../../../src/services/tracking', () => ({}));
jest.mock('../../../src/services/redis-client', () => ({}));

const loadMock = mockPath => {
    const pathName = path.resolve(__dirname, `../../mocks/${mockPath}.json`);
    return fs.readFileSync(pathName, 'utf8');
};

const token1 = 'c11c51186e0ff651b5c43d14e8b34dd5203ad8ce470bc1c79a231976adea231f4dba7b940c332f68b8cd012c67a62746a126762704a9eeaff1319cf2b968f8cbcd89992d0ad36ac77fdb90e50ce3e2825a88330217ee855bec43553472119337a01772361229dfdaa977d53ef9f1ef49cc7c8611145a6f4c08b1753c995f213eedfc5faef08f3ecb51ddb05b3a959a5768f73caff5e2ac4ef22820ce2712e0435456cea8e3f0bc583a17e179e4f1a64f91852630dd11d4fe5d12798ea598cb25d36d5bce4f7a62fab5258b3e60757a0bf603e635b414f5dff8295d59f931b21480bddcd1c05b36b90b793dd809b10f7bb6b9e9205bae4a8e39057b6b1e692f5ce4601a3b7aff67fef000712b7af2b4bd3ebc4c7c7c40b24c6f5dd14be85a9f7f08f49b677330c9c96edd8721f7458f5c2f3f515f174d5057cce86042f4598ac0f6065b7fb3b71f7d7f8521f77c7341b62b0dd3f660881ac012d6955fdf844d8ed635f65fdaf161ff863cc5acdfe7600a';
const token2 = 'c11c51186e0ff651b5c43d14e8b34dd5c0da737a10bfc25d724d29c5d03b30d89fc30e9e797bb1fe9e8b70099adcdc1e6f2f6ecca4b91a584fdfac761474c576b769f130a40357442a81a9ca7cfbec47ed0d43d2001111dd4f1c6f3450d448e2213e2d5604406f577c5a5a5f2df2201c7e998b5a7c9d67bd0c8a8db40a8773dee3247ccace0fa965474b9cb7dd4bffed8fefe49b09d38681d60ae297ba41a7ed71421b68537a37d6296a601c1eac115f8f2e905a4e764910a0804a44b7e86a6f040ede2b1c17dd7260d1beea8e40e79660b44485aab9f3ef92848c2e1ee9213bc4eccdfcd6396e2b74311d120bbe4ef55ef363ccc8c6faa78e43fb2e9d07e7f19ab75eab70f53dd806e506e82859e6ab3420998e9130c1f33ca87e77727380367af28ccb63b31831a91ffece51213a0f3dd9245863dfac76bc2d082203f5426a3043b117555bf4f02a9427266cdbd78412abeb56387dcc52c6e56eaa95131e1e9bf6363b6e7af9a0e6e4b839ec1eb4c9';
const tokenWithoutTimestamp = 'c11c51186e0ff651b5c43d14e8b34dd5203ad8ce470bc1c79a231976adea231f4dba7b940c332f68b8cd012c67a62746a126762704a9eeaff1319cf2b968f8cbcd89992d0ad36ac77fdb90e50ce3e2825a88330217ee855bec43553472119337a01772361229dfdaa977d53ef9f1ef49cc7c8611145a6f4c08b1753c995f213eedfc5faef08f3ecb51ddb05b3a959a5768f73caff5e2ac4ef22820ce2712e0435456cea8e3f0bc583a17e179e4f1a64f91852630dd11d4fe5d12798ea598cb25d36d5bce4f7a62fab5258b3e60757a0bf603e635b414f5dff8295d59f931b21480bddcd1c05b36b90b793dd809b10f7bb6b9e9205bae4a8e39057b6b1e692f5ce4601a3b7aff67fef000712b7af2b4bd3ebc4c7c7c40b24c6f5dd14be85a9f7f08f49b677330c9c96edd8721f7458f5c2f3f515f174d5057cce86042f4598ac0e120fea2f28f2be6f3a384e1d549c4cb';

const VALID_API_KEY = 'abc123';

router.controllers = {
    FreeTaxisController,
};
router.namespace('/promotions', promotionsRouter => {
    promotionsRouter.resources('free-taxi', {
        only: ['create', 'update', 'destroy'],
    });
});

Tracking.cloudwatch = {
    counter: {
        increment: jest.fn(),
    },
    timer: {
        add: jest.fn(),
    },
};

const app = express()
    .use(featureToggleMiddleware)
    .use(cookieParser())
    .use(trackingCookiesMiddleware)
    .use(bodyParser.json())
    .use((req, res, next) => {
        req.session = {
            customer: {
                sessionId: 'cust_session_id',
                device: {
                    device_category: 'unknown',
                },
            },
        };
        res.branding = {
            details: {
                brandKey: 'booking-taxi',
            },
        };
        next();
    })
    .use(router.router);

const requestApp = (expressApp, method, url, authorised = true) => {
    const apiKey = (authorised) ? VALID_API_KEY : 'not-valid';
    return request(expressApp)[method](url)
        .set('X-API-KEY', apiKey);
};

describe('Free Taxi API', () => {
    describe('#CREATE - generate a token', () => {
        const params = {
            affiliateBookingReference: '123456789',
            language: 'en-gb',
            pickup: {
                iata: 'MAN',
                date: '2019-05-21',
                passengers: 2,
            },
            dropoff: {
                lat: '53.4750868',
                lng: '-2.2533695',
                hotelName: 'Hilton Deansgate',
            },
            passenger: {
                email: 'ridewaystestteam@gmail.com',
                phone: '+44 11349 60000',
                title: 'Mr',
                firstName: 'Test',
                lastName: 'Team',
            },
        };

        describe('when the feature toggle is off', () => {
            const url = '/promotions/free-taxi?rw-feature-toggle[bkng-free-taxi-promotion]=false';

            it('returns an "not found" error response', done => {
                requestApp(app, 'post', url)
                    .send(params)
                    .end((err, res) => {
                        if (err) return done(err);
                        expect(res.statusCode).toBe(404);
                        done();
                    });
            });
        });

        describe('when api key is invalid', () => {
            const url = '/promotions/free-taxi?rw-feature-toggle[bkng-free-taxi-promotion]=true';

            it('returns a 403 permission denied', done => {
                requestApp(app, 'post', url, false)
                    .send(params)
                    .end((err, res) => {
                        if (err) return done(err);
                        expect(res.statusCode).toBe(403);
                        expect(res.body.error).toBe('Forbidden');
                        done();
                    });
            });
        });

        describe('when the feature toggle is on', () => {
            const url = '/promotions/free-taxi?rw-feature-toggle[bkng-free-taxi-promotion]=true';

            describe('validation', () => {
                describe('when all params are supplied', () => {
                    it('returns a success response', done => {
                        requestApp(app, 'post', url)
                            .send(params)
                            .end((err, res) => {
                                if (err) return done(err);
                                expect(res.statusCode).toBe(200);
                                done();
                            });
                    });
                });

                describe('when only non-required params are missing', () => {
                    it('returns a success response', done => {
                        requestApp(app, 'post', url)
                            .send({
                                ...params,
                                passenger: {
                                    ...params.passenger,
                                    firstName: undefined,
                                    title: undefined,
                                },
                            })
                            .end((err, res) => {
                                if (err) return done(err);
                                expect(res.statusCode).toBe(200);
                                done();
                            });
                    });
                });

                describe('when required params are missing', () => {
                    it('returns a "bad request" error response', done => {
                        requestApp(app, 'post', url)
                            .send({
                                ...params,
                                dropoff: {
                                    ...params.dropoff,
                                    lat: undefined,
                                },
                                affiliateBookingReference: undefined,
                            })
                            .end((err, res) => {
                                if (err) return done(err);
                                expect(res.statusCode).toBe(400);
                                done();
                            });
                    });

                    it('returns a list of validation errors', done => {
                        requestApp(app, 'post', url)
                            .send({
                                ...params,
                                dropoff: {
                                    ...params.dropoff,
                                    lat: undefined,
                                },
                                affiliateBookingReference: undefined,
                            })
                            .end((err, res) => {
                                if (err) return done(err);
                                expect(res.body.details).toEqual({
                                    validationErrors: [
                                        {
                                            code: 'INVALID_PARAMETER_AFFILIATE_BOOKING_REFERENCE',
                                            message: '"affiliateBookingReference" is required',
                                        },
                                        {
                                            code: 'INVALID_PARAMETER_LAT',
                                            message: '"lat" is required',
                                        },
                                    ],
                                });
                                done();
                            });
                    });
                });

                describe('when required params are present but invalid', () => {
                    describe('when the language code is in an invalid format', () => {
                        it('returns a validation error message', done => {
                            requestApp(app, 'post', url)
                                .send({
                                    ...params,
                                    language: 'werwsfsdf',
                                })
                                .end((err, res) => {
                                    if (err) return done(err);
                                    expect(res.body.details).toEqual({
                                        validationErrors: [
                                            {
                                                code: 'INVALID_PARAMETER_LANGUAGE',
                                                message: '"language" must be one of [bg-bg, ca-es, cs-cz, da-dk, de-de, el-gr, en-gb, es-es, et-ee, fi-fi, fr-fr, hr-hr, hu-hu, id-id, is-is, it-it, ja-jp, ko-kr, lt-lt, lv-lv, ms-my, nl-nl, no-no, pl-pl, pt-br, pt-pt, ro-ro, ru-ru, sk-sk, sl-si, sr-rs, sv-se, tg-ph, th-th, tr-tr, uk-ua, vi-vn, zh-cn, zh-hk]',
                                            },
                                        ],
                                    });
                                    done();
                                });
                        });
                    });
                });
            });

            describe('encryption', () => {
                beforeAll(() => {
                    MockDate.set(moment.utc(0).format());
                });
                afterAll(MockDate.reset);

                it('returns a token of encrypted user data and URL to redeem a free taxi', done => {
                    requestApp(app, 'post', url)
                        .send(params)
                        .end((err, res) => {
                            if (err) return done(err);
                            expect(res.body).toEqual({
                                token: token1,
                                redeemUrl: `https://taxi.booking.com/en-gb/promotions/free-taxi/${token1}?utm_source=booking.com&utm_medium=intra&utm_campaign=bookingfreetaxi`,
                            });
                            done();
                        });
                });

                it('returns a different token when any of the params are different', done => {
                    requestApp(app, 'post', url)
                        .send({
                            ...params,
                            affiliateBookingReference: '987654321',
                        })
                        .end((err, res) => {
                            if (err) return done(err);
                            expect(res.body).toEqual({
                                token: token2,
                                redeemUrl: `https://taxi.booking.com/en-gb/promotions/free-taxi/${token2}?utm_source=booking.com&utm_medium=intra&utm_campaign=bookingfreetaxi`,
                            });
                            done();
                        });
                });

                describe('when encryption fails', () => {
                    it('returns an error response', done => {
                        jest.spyOn(cryptoUtil, 'cipher').mockImplementationOnce(() => {
                            throw new Error();
                        });

                        requestApp(app, 'post', url)
                            .send(params)
                            .end((err, res) => {
                                if (err) return done(err);
                                expect(res.statusCode).toBe(500);
                                done();
                            });
                    });
                });

                describe('when an unexpected error occurs', () => {
                    it('returns an error response', done => {
                        Tracking.cloudwatch.counter.increment.mockImplementationOnce(() => {
                            throw new Error('whoopsies');
                        });

                        requestApp(app, 'post', url)
                            .send(params)
                            .end((err, res) => {
                                if (err) return done(err);
                                expect(res.statusCode).toBe(500);
                                done();
                            });
                    });
                });
            });

            describe('metrics', () => {
                beforeEach(() => {
                    let milliseconds = 0;
                    Date.now = jest.fn(() => {
                        milliseconds += 1000;
                        return milliseconds;
                    });
                });

                afterEach(jest.clearAllMocks);

                it('sends a metric when sending a success response', done => {
                    requestApp(app, 'post', url)
                        .send(params)
                        .end(err => {
                            if (err) return done(err);
                            expect(Tracking.cloudwatch.counter.increment).toBeCalledWith(
                                'bkng-free-taxi.encryption.success',
                            );
                            done();
                        });
                });

                it('sends a metric when sending a success response for the date of pickup', done => {
                    requestApp(app, 'post', url)
                        .send(params)
                        .end(err => {
                            if (err) return done(err);
                            expect(Tracking.cloudwatch.counter.increment).toBeCalledWith(
                                'bkng-free-taxi.encryption.travel-date.2019-05-21',
                            );
                            done();
                        });
                });

                it('sends a metric when there is an uncaught exception', done => {
                    Tracking.cloudwatch.counter.increment.mockImplementationOnce(() => {
                        throw new Error();
                    });

                    requestApp(app, 'post', url)
                        .send(params)
                        .end(err => {
                            if (err) return done(err);
                            expect(Tracking.cloudwatch.counter.increment).toBeCalledWith(
                                'bkng-free-taxi.encryption.error',
                            );
                            done();
                        });
                });

                it('sends a metric when validation succeeds', done => {
                    requestApp(app, 'post', url)
                        .send(params)
                        .end(err => {
                            if (err) return done(err);
                            expect(Tracking.cloudwatch.counter.increment).toBeCalledWith(
                                'bkng-free-taxi.validation.success',
                            );
                            done();
                        });
                });

                it('sends a metric when validation fails', done => {
                    requestApp(app, 'post', url)
                        .send({
                            ...params,
                            dropoff: {
                                ...params.dropoff,
                                hotelName: undefined,
                            },
                            affiliateBookingReference: undefined,
                        })
                        .end(err => {
                            if (err) return done(err);
                            expect(Tracking.cloudwatch.counter.increment).toBeCalledWith(
                                'bkng-free-taxi.validation.failures',
                            );
                            done();
                        });
                });

                it('sends specific metrics for validation failures', done => {
                    requestApp(app, 'post', url)
                        .send({
                            ...params,
                            dropoff: {
                                ...params.dropoff,
                                lat: undefined,
                            },
                            affiliateBookingReference: undefined,
                        })
                        .end(err => {
                            if (err) return done(err);
                            expect(Tracking.cloudwatch.counter.increment).toBeCalledWith(
                                'bkng-free-taxi.validation.failure.INVALID_PARAMETER_LAT',
                            );
                            expect(Tracking.cloudwatch.counter.increment).toBeCalledWith(
                                'bkng-free-taxi.validation.failure.INVALID_PARAMETER_AFFILIATE_BOOKING_REFERENCE',
                            );
                            done();
                        });
                });

                it('sends a metric when encryption fails', done => {
                    jest.spyOn(cryptoUtil, 'cipher').mockImplementationOnce(() => {
                        throw new Error();
                    });

                    requestApp(app, 'post', url)
                        .send(params)
                        .end(err => {
                            if (err) return done(err);
                            expect(Tracking.cloudwatch.counter.increment).toBeCalledWith(
                                'bkng-free-taxi.encryption.failure',
                            );
                            done();
                        });
                });

                it('sends a [bkng-free-taxi.timer.encryption] metric when validation succeeds', done => {
                    requestApp(app, 'post', url)
                        .send(params)
                        .end(err => {
                            if (err) return done(err);
                            expect(Tracking.cloudwatch.timer.add).toBeCalledWith(
                                'bkng-free-taxi.timer.encryption',
                                2000,
                            );
                            done();
                        });
                });
            });
        });
    });

    describe('#UPDATE - complete a booking', () => {
        const initialCustParams = {
            email: 'adifferentemail@gmail.com',
            phone: '+44 11349 60001',
            title: 'Miss',
            firstName: 'Another',
            lastName: 'Tester',
            flightNumber: 'ABC123',
            flightArrivalDateTime: moment().add(100, 'hours').format('YYYY-MM-DDTHH:mm:ss.SSS'),
        };

        describe('when the feature toggle is off', () => {
            const url = `/promotions/free-taxi/${token1}?rw-feature-toggle[bkng-free-taxi-promotion]=false`;

            it('returns an "not found" error response', done => {
                requestApp(app, 'put', url)
                    .send(initialCustParams)
                    .end((err, res) => {
                        if (err) return done(err);
                        expect(res.statusCode).toBe(404);
                        done();
                    });
            });
        });

        describe('when the feature toggle is on', () => {
            let janusUrl;
            let janusApiKey;
            let servicesUrl;
            let servicesApiKey;
            let eligibilityResponse;
            let searchResponse;
            let bookingResponse;
            let response;

            beforeAll(async () => {
                janusUrl = await config.valueFor('hosts.janus.url');
                janusApiKey = await config.valueFor('hosts.janus.apiKey');
                servicesUrl = await config.valueFor('hosts.services.url');
                servicesApiKey = await config.valueFor('hosts.services.apiKey');
                DataModels.config = {
                    janus: {
                        endpoint: janusUrl,
                        apikey: janusApiKey,
                    },
                };
            });

            beforeEach(() => {
                eligibilityResponse = [200, {
                    freeTaxiEligible: true,
                }];
                searchResponse = [200, loadMock('janus/rates-single')];
                bookingResponse = [200, {
                    bookingReference: '10090931',
                }];
                redisClient.privateKeys = {};
                redisClient.set = (someKey, someValue) => new Promise(resolve => {
                    redisClient.privateKeys[someKey] = someValue;
                    resolve();
                });
                redisClient.get = someKey => new Promise(resolve => {
                    const valueToReturn = redisClient.privateKeys[someKey];
                    resolve(valueToReturn);
                });
                redisClient.del = keyToDelete => new Promise(resolve => {
                    delete redisClient.privateKeys[keyToDelete];
                    resolve();
                });
                redisClient.expire = () => Promise.resolve();
                jest.clearAllMocks();
            });

            afterEach(nock.cleanAll);

            const makeRequest = (done, customerParams, token = token1) => {
                const url = `/promotions/free-taxi/${token}?rw-feature-toggle[bkng-free-taxi-promotion]=true`;
                nock(servicesUrl)
                    .post('/places/geolocation/reverse', '53.4750868,-2.2533695')
                    .reply(200, loadMock('places/geolocation/reverse'))
                    .post('/places/autocomplete', {
                        searchText: 'Hilton Deansgate',
                        radiusSearchPlaceId: 'ChIJWYHVueexe0gRH3eQEiZCFsA',
                        language: 'en-gb',
                        augmentedPlaceOfInterest: true,
                    })
                    .reply(200, loadMock('places/autocomplete'));

                nock(servicesUrl, {
                    reqheaders: {
                        affiliateCode: 'bookingfreetaxi',
                    },
                })
                    .get('/v2/bookings/affiliate-ref/123456789')
                    .query({
                        apikey: servicesApiKey,
                    })
                    .reply(...eligibilityResponse);

                nock(janusUrl)
                    .get('/v2/rates')
                    .query({
                        apikey: janusApiKey,
                        pickup: 'MAN',
                        pickupdatetime: customerParams.flightArrivalDateTime,
                        dropoff: '53.4750868,-2.2533695',
                        dropoffestablishment: 'Hilton Deansgate',
                        affiliate: 'bookingfreetaxi',
                        passenger: 2,
                    })
                    .reply(...searchResponse)
                    .post('/v2/bookings', {
                        affiliate: 'bookingfreetaxi',
                        affiliateReference: '123456789',
                        customerCurrency: 'EUR',
                        journeys: [{
                            legs: [{
                                searchReference: '69e753fe-7f46-446a-a983-825ab38a3bca',
                                resultReference: '5',
                                passengerFlightNumber: 'ABC123',
                            }],
                        }],
                        request: {
                            passenger: {
                                title: 'Miss',
                                firstName: 'Another',
                                lastName: 'Tester',
                                email: 'adifferentemail@gmail.com',
                                cellphone: '+44 11349 60001',
                                language: 'en-gb',
                                consentToMarketing: false,
                            },
                        },
                    })
                    .reply(...bookingResponse);

                requestApp(app, 'put', url)
                    .set(
                        'Cookie', ['bkng=11UmFuZG9tSVYkYWJjIyh9ZLYeCVu3sdVkXnbPVMfSyh1HwYJGTQfBGu4Wrg1TQUx6bNh3bKg7SOySsDGtjiVPZxfyMCIBJL9hNcKkhoI0a0feX0kj02I6HxzB10NETKVS3buycWYdaaiVyeQwKQYJdhTCmqk22hdidxkYU9DBzAKnwUcDOV87Og9c5uJbYIpAciD%2B8wSzHpsCcAUbhq6J%2BeRrIlbaLVWEe%2BUlNawIk3F9F1u73OzyIdJ2dZ9eMrAk;rideways_afl=rideways&test_utm_campaign&test_utm_term&test_utm_medium&affiliatePage&test_utm_source&test_utm_content&test_adcamp'])
                    .set(
                        'user-agent',
                        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/71.0.3578.98 Safari/537.36',
                    )
                    .send(customerParams)
                    .end((err, res) => {
                        if (err) {
                            response = err;
                        } else {
                            response = res;
                        }
                        done();
                    });
            };

            const makeDoubleRequest = (done, customerParams) => {
                const url = `/promotions/free-taxi/${token1}?rw-feature-toggle[bkng-free-taxi-promotion]=true`;
                nock(servicesUrl)
                    .post('/places/geolocation/reverse', '53.4750868,-2.2533695')
                    .reply(200, loadMock('places/geolocation/reverse'))
                    .post('/places/autocomplete', {
                        searchText: 'Hilton Deansgate',
                        radiusSearchPlaceId: 'ChIJWYHVueexe0gRH3eQEiZCFsA',
                        language: 'en-gb',
                        augmentedPlaceOfInterest: true,
                    })
                    .reply(200, loadMock('places/autocomplete'));

                nock(servicesUrl, {
                    reqheaders: {
                        affiliateCode: 'bookingfreetaxi',
                    },
                })
                    .get('/v2/bookings/affiliate-ref/123456789')
                    .query({
                        apikey: servicesApiKey,
                    })
                    .reply(...eligibilityResponse);

                nock(janusUrl)
                    .get('/v2/rates')
                    .query({
                        apikey: janusApiKey,
                        pickup: 'MAN',
                        pickupdatetime: customerParams.flightArrivalDateTime,
                        dropoff: '53.4750868,-2.2533695',
                        dropoffestablishment: 'Hilton Deansgate',
                        affiliate: 'bookingfreetaxi',
                        passenger: 2,
                    })
                    .reply(...searchResponse)
                    .post('/v2/bookings', {
                        affiliate: 'bookingfreetaxi',
                        affiliateReference: '123456789',
                        customerCurrency: 'EUR',
                        journeys: [{
                            legs: [{
                                searchReference: '69e753fe-7f46-446a-a983-825ab38a3bca',
                                resultReference: '5',
                            }],
                        }],
                        request: {
                            passenger: {
                                title: 'Miss',
                                firstName: 'Another',
                                lastName: 'Tester',
                                email: 'adifferentemail@gmail.com',
                                cellphone: '+44 11349 60001',
                                language: 'en-gb',
                                consentToMarketing: false,
                            },
                        },
                    })
                    .reply(...bookingResponse);

                requestApp(app, 'put', url)
                    .send(customerParams)
                    .end(() => {
                        requestApp(app, 'put', url)
                            .send(customerParams)
                            .end((err, res) => {
                                response = res;
                                if (done) done();
                            });
                    });
            };

            describe('When multiple simultaneous requests are attempted', () => {
                describe('When a booking is already in progress', () => {
                    beforeEach(done => {
                        redisClient.privateKeys[`bkng-free-taxi:${token1}`] = 'in progress';
                        makeRequest(done, initialCustParams);
                    });

                    it('returns a success response', () => {
                        expect(response.statusCode).toBe(403);
                    });
                });
            });

            describe('When user attempts to make multiple bookings when lead time is less than 72 hours', () => {
                beforeEach(done => {
                    bookingResponse = [403, {
                        message: 'Lead time too short',
                    }];
                    let testCustParams = initialCustParams;
                    testCustParams = {
                        flightArrivalDateTime: moment().format('YYYY-MM-DDTHH:mm:ss.SSS'),
                    };
                    makeDoubleRequest(done, testCustParams);
                });

                it('Should not allow the same booking reference to be used multiple times', () => {
                    expect(response.text.toLowerCase()).toContain('not enough lead time');
                });
            });

            describe('When clearing cache keys fails', () => {
                describe('When booking is successful', () => {
                    beforeEach(done => {
                        redisClient.del = jest.fn(() => Promise.reject(new Error('some error')));
                        makeRequest(done, initialCustParams);
                    });

                    it('returns the usual success response, without being affected.', () => {
                        expect(response.statusCode).toBe(200);
                    });
                });

                describe('When booking has failed', () => {
                    describe('When eligibility check fails', () => {
                        beforeEach(done => {
                            redisClient.del = jest.fn(() => Promise.reject(new Error('some error')));
                            eligibilityResponse = [500, {
                                message: 'Internal Server Error',
                            }];
                            makeRequest(done, initialCustParams);
                        });

                        it('returns the "eligibility check failure" error, not the redis error', () => {
                            expect(response.statusCode).toBe(400);
                        });
                    });

                    describe('When eligibility check returns false', () => {
                        beforeEach(done => {
                            redisClient.del = jest.fn(() => Promise.reject(new Error('some error')));
                            eligibilityResponse = [200, {
                                freeTaxiEligible: false,
                            }];
                            makeRequest(done, initialCustParams);
                        });

                        it('returns the "not eligable" error, not the redis error', () => {
                            expect(response.statusCode).toBe(400);
                        });
                    });

                    describe('When there are no search results', () => {
                        beforeEach(done => {
                            redisClient.del = jest.fn(() => Promise.reject(new Error('some error')));
                            searchResponse = [200, loadMock('janus/rates-single-no-results')];
                            makeRequest(done, initialCustParams);
                        });

                        it('returns the "no search results" error, not the redis error', () => {
                            expect(response.statusCode).toBe(400);
                        });
                    });

                    describe('when the search fails', () => {
                        beforeEach(done => {
                            redisClient.del = jest.fn(() => Promise.reject(new Error('some error')));
                            searchResponse = [400, {
                                message: 'Pickup date time is in the past',
                            }];
                            makeRequest(done, initialCustParams);
                        });

                        it('returns the "search failure" error, not the redis error', () => {
                            expect(response.statusCode).toBe(400);
                        });
                    });

                    describe('when the booking fails', () => {
                        beforeEach(done => {
                            redisClient.del = jest.fn(() => Promise.reject(new Error('some error')));
                            bookingResponse = [500, {
                                message: 'Something went wrong',
                            }];
                            makeRequest(done, initialCustParams);
                        });

                        it('returns the "booking failure" error, not the redis error', () => {
                            expect(response.statusCode).toBe(400);
                        });
                    });
                });
            });

            describe('Success using token without timestamp', () => {
                beforeEach(done => {
                    makeRequest(done, initialCustParams, tokenWithoutTimestamp);
                });
                it('should NOT send a Cloudwatch timer metric for redemption time if the timestamp is not present in the token', () => {
                    expect(Tracking.cloudwatch.timer.add).not.toBeCalledWith('bkng-free-taxi.timer.token-generation-to-redemption', expect.anything());
                });
            });

            describe('success', () => {
                beforeEach(done => {
                    makeRequest(done, initialCustParams);
                });

                it('returns a success response', () => {
                    expect(response.statusCode).toBe(200);
                });

                it('returns a booking reference', () => {
                    expect(response.body.bookingReference).toBe('10090931');
                });

                it('sends a CloudWatch metric for eligibility check success', () => {
                    expect(Tracking.cloudwatch.counter.increment).toBeCalledWith('bkng-free-taxi.eligibility.success');
                });

                it('sends a CloudWatch metric for an eligible booking', () => {
                    expect(Tracking.cloudwatch.counter.increment).toBeCalledWith('bkng-free-taxi.eligibility.eligible');
                });

                it('sends a Cloudwatch metric', () => {
                    expect(Tracking.cloudwatch.counter.increment).toBeCalledWith('bkng-free-taxi.redeem.success');
                });

                it('clears the in-progress booking key in Redis for this booking token', () => {
                    expect(redisClient.privateKeys[`bkng-free-taxi:${token1}`]).toBeFalsy();
                });

                it('sends a Cloudwatch metric for the date of pick-up', () => {
                    expect(Tracking.cloudwatch.counter.increment).toBeCalledWith('bkng-free-taxi.redeem.travel-date.2019-05-21');
                });

                describe('timer metrics', () => {
                    const { now } = Date;

                    beforeEach(() => {
                        let milliseconds = 0;
                        Date.now = jest.fn(() => {
                            milliseconds += 1000;
                            return milliseconds;
                        });
                    });

                    afterAll(() => {
                        Date.now = now;
                    });

                    it('sends a Cloudwatch timer metric for the search request', () => {
                        expect(Tracking.cloudwatch.timer.add).toBeCalledWith('bkng-free-taxi.timer.search', 1000);
                    });

                    it('sends a Cloudwatch timer metric for the booking request', () => {
                        expect(Tracking.cloudwatch.timer.add).toBeCalledWith('bkng-free-taxi.timer.book', 1000);
                    });

                    it('sends a Cloudwatch timer metric for the combined requests', () => {
                        expect(Tracking.cloudwatch.timer.add).toBeCalledWith('bkng-free-taxi.timer.search-book-total', 4000);
                    });

                    it('sends a Cloudwatch timer metric for the time between token generation and redemption', () => {
                        expect(Tracking.cloudwatch.timer.add).toBeCalledWith('bkng-free-taxi.timer.token-generation-to-redemption', 11000);
                    });

                    it('sends a Cloudwatch timer metric for the time between redemption and travel date', () => {
                        expect(Tracking.cloudwatch.timer.add).toBeCalledWith('bkng-free-taxi.timer.token-redemption-to-travel', 1558396790000);
                    });
                });

                describe('Kineses events', () => {
                    beforeAll(() => {
                        MockDate.set(new Date('2019-03-20 GMT+03:00'));
                    });

                    afterAll(MockDate.reset);

                    it('fires a BookingEvent on Kinesis', () => {
                        const expectedEvent = new BookingEvent(
                            {
                                sessionId: 'cust_session_id',
                                bookingReference: '10090931',
                            },
                            {
                                utm_source: 'test_utm_source',
                                utm_campaign: 'test_utm_campaign',
                                utm_term: 'test_utm_term',
                                utm_medium: 'test_utm_medium',
                                utm_content: 'test_utm_content',
                                deviceType: 'Other 0.0.0',
                                operatingSystem: 'Mac OS X 10.13.6',
                                device_category: 'unknown',
                                adcamp: 'test_adcamp',
                            },
                        );
                        expect(KinesisStream.prototype.fire.mock.calls[0]).toEqual([expectedEvent]);
                    });

                    it('fires a BkingExperimentEvent on Kinesis', () => {
                        const paramDateTime = initialCustParams.flightArrivalDateTime;
                        const expectedEvent = new BkingExperimentEvent({
                            bookingReference: '10090931',
                        }, {
                                bookingDate: '2019-03-19',
                                siteType: null,
                                cancellaltionStatus: null,
                                cancellationDate: null,
                                emkEmailId: undefined,
                                experimentSeed: '005B22475CE006EF4501F6C88F37FBA9E7',
                                pickupDate: moment(paramDateTime).format('YYYY-MM-DD'),
                                pickupTime: moment(paramDateTime).format('HH:mm'),
                                returnJourney: false,
                                returnPickupDate: null,
                                returnPickupTime: null,
                                adcamp: 'test_adcamp',
                            });
                        expect(KinesisStream.prototype.fire.mock.calls[1]).toEqual([expectedEvent, 'bkng-experiment']);
                    });
                });
            });

            describe('failures', () => {
                describe('When the lead time of the booking attempt is < 72 hours', () => {
                    beforeEach(done => {
                        bookingResponse = [403, {
                            message: 'Lead time too short',
                        }];
                        let testCustParams = initialCustParams;
                        testCustParams = {
                            flightArrivalDateTime: moment().format('YYYY-MM-DDTHH:mm:ss.SSS'),
                        };
                        makeRequest(done, testCustParams);
                    });

                    it('Returns an error response', () => {
                        expect(response.statusCode).toBe(403);
                    });
                });

                describe('when the Booking.com reference has previously been used', () => {
                    beforeEach(done => {
                        eligibilityResponse = [200, {
                            freeTaxiEligible: false,
                        }];
                        makeRequest(done, initialCustParams);
                    });

                    it('clears the in-progress booking key in Redis for this booking token', () => {
                        expect(redisClient.privateKeys[`bkng-free-taxi:${token1}`]).toBeFalsy();
                    });

                    it('returns an error response', () => {
                        expect(response.statusCode).toBe(400);
                    });

                    it('returns a validation error', () => {
                        expect(response.body.details.validationErrors).toEqual([
                            {
                                code: 'FREE_TAXI_ALREADY_REDEEMED',
                                message: 'This affiliate booking reference has already redeemed a free taxi',
                            },
                        ]);
                    });

                    it('sends a specific Cloudwatch metric', () => {
                        expect(Tracking.cloudwatch.counter.increment).toBeCalledWith('bkng-free-taxi.eligibility.not-eligible');
                    });

                    it('sends a general Cloudwatch failure metric', () => {
                        expect(Tracking.cloudwatch.counter.increment).toBeCalledWith('bkng-free-taxi.redeem.failure');
                    });
                });

                describe('when the eligibility check fails', () => {
                    beforeEach(done => {
                        eligibilityResponse = [500, {
                            message: 'Internal Server Error',
                        }];
                        makeRequest(done, initialCustParams);
                    });

                    it('returns an error response', () => {
                        expect(response.statusCode).toBe(400);
                    });

                    it('returns an error message', () => {
                        expect(response.body.message).toEqual('Eligibility check failed');
                    });

                    it('sends a specific Cloudwatch metric', () => {
                        expect(Tracking.cloudwatch.counter.increment).toBeCalledWith('bkng-free-taxi.eligibility.failure');
                    });

                    it('sends a general Cloudwatch failure metric', () => {
                        expect(Tracking.cloudwatch.counter.increment).toBeCalledWith('bkng-free-taxi.redeem.failure');
                    });

                    it('clears the in-progress booking key in Redis for this booking token', () => {
                        expect(redisClient.privateKeys[`bkng-free-taxi:${token1}`]).toBeFalsy();
                    });
                });

                describe('when the search returns no results', () => {
                    beforeEach(done => {
                        searchResponse = [200, loadMock('janus/rates-single-no-results')];
                        makeRequest(done, initialCustParams);
                    });

                    it('returns an error response', () => {
                        expect(response.statusCode).toBe(400);
                    });

                    it('returns an error message', () => {
                        expect(response.body.message).toEqual('No results found for search');
                    });

                    it('sends a specific Cloudwatch metric', () => {
                        expect(Tracking.cloudwatch.counter.increment).toBeCalledWith('bkng-free-taxi.search.no-results');
                    });

                    it('sends a general Cloudwatch failure metric', () => {
                        expect(Tracking.cloudwatch.counter.increment).toBeCalledWith('bkng-free-taxi.redeem.failure');
                    });

                    it('clears the in-progress booking key in Redis for this booking token', () => {
                        expect(redisClient.privateKeys[`bkng-free-taxi:${token1}`]).toBeFalsy();
                    });
                });

                describe('when the search fails', () => {
                    beforeEach(done => {
                        searchResponse = [400, {
                            message: 'Pickup date time is in the past',
                        }];
                        makeRequest(done, initialCustParams);
                    });

                    it('returns an error response', () => {
                        expect(response.statusCode).toBe(400);
                    });

                    it('returns an error message', () => {
                        expect(response.body.message).toBe('Search request failed');
                    });

                    it('sends a specific Cloudwatch metric', () => {
                        expect(Tracking.cloudwatch.counter.increment).toBeCalledWith('bkng-free-taxi.search.failure');
                    });

                    it('sends a general Cloudwatch failure metric', () => {
                        expect(Tracking.cloudwatch.counter.increment).toBeCalledWith('bkng-free-taxi.redeem.failure');
                    });

                    it('clears the in-progress booking key in Redis for this booking token', () => {
                        expect(redisClient.privateKeys[`bkng-free-taxi:${token1}`]).toBeFalsy();
                    });
                });

                describe('when the booking fails', () => {
                    beforeEach(done => {
                        bookingResponse = [500, {
                            message: 'Something went wrong',
                        }];
                        makeRequest(done, initialCustParams);
                    });

                    it('returns an error response', () => {
                        expect(response.statusCode).toBe(400);
                    });

                    it('returns an error message', () => {
                        expect(response.body.message).toBe('Booking request failed');
                    });

                    it('sends a specific Cloudwatch metric', () => {
                        expect(Tracking.cloudwatch.counter.increment).toBeCalledWith('bkng-free-taxi.booking.failure');
                    });

                    it('sends a general Cloudwatch failure metric', () => {
                        expect(Tracking.cloudwatch.counter.increment).toBeCalledWith('bkng-free-taxi.redeem.failure');
                    });

                    it('clears the in-progress booking key in Redis for this booking token', () => {
                        expect(redisClient.privateKeys[`bkng-free-taxi:${token1}`]).toBeFalsy();
                    });
                });

                describe('when the API fails unexpectedly', () => {
                    beforeEach(done => {
                        Tracking.cloudwatch.timer.add.mockImplementation(() => {
                            throw new Error('Unexpected error');
                        });
                        makeRequest(done, initialCustParams);
                    });

                    it('returns an error response', () => {
                        expect(response.statusCode).toBe(500);
                    });

                    it('returns an error message', () => {
                        expect(response.body.message).toBe('Search and book request encountered an error');
                    });

                    it('sends a specific Cloudwatch metric', () => {
                        expect(Tracking.cloudwatch.counter.increment).toBeCalledWith('bkng-free-taxi.redeem.error');
                    });

                    it('clears the in-progress booking key in Redis for this booking token', () => {
                        expect(redisClient.privateKeys[`bkng-free-taxi:${token1}`]).toBeFalsy();
                    });
                });
            });
        });
    });

    describe('#DELETE - cancel and permanently invalidate a booking', () => {
        const bcomReferenceToCancel = '123456';
        const baseUrl = `/promotions/free-taxi/${bcomReferenceToCancel}?rw-feature-toggle[bkng-free-taxi-promotion]=`;
        describe('when the feature toggle is off', () => {
            const featureToggleActivated = false;
            const url = `${baseUrl}${featureToggleActivated}`;
            it('returns an "not found" error response', done => {
                requestApp(app, 'delete', url)
                    .end((err, res) => {
                        if (err) return done(err);
                        expect(res.statusCode).toBe(404);
                        done();
                    });
            });
        });

        describe('when the feature toggle is on', () => {
            describe('when api key is invalid', () => {
                const featureToggleActivated = true;
                const url = `${baseUrl}${featureToggleActivated}`;

                it('returns a 403 permission denied', done => {
                    requestApp(app, 'delete', url, false)
                        .end((err, res) => {
                            if (err) return done(err);
                            expect(res.statusCode).toBe(403);
                            expect(res.body.error).toBe('Forbidden');
                            done();
                        });
                });
            });

            describe('when the api key is valid', () => {
                describe('when a valid Booking.com reference is passed', () => {
                    describe('when the call to DynamoDB fails', () => {

                    });

                    describe('when the call to DynamoDB succeeds', () => {

                    });
                });


            });
        });
    });
});
