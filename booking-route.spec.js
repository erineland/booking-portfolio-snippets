/* eslint-disable no-shadow */
import express from 'express';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import router from '@rides/router';
import winston from 'winston';
import {
    Rate,
} from '@rides/data-models';

import featureToggleMiddleware from '../../src/middleware/feature-toggles';
import trackingCookiesMiddleware from '../../src/middleware/tracking-cookies';
import Tracking from '../../src/services/tracking';
import redisClient from '../../src/services/redis-client';
import FlightService from '../../src/services/flight-service';
import legacyRoutes from '../../src/legacy-routes';
import path from 'path';
import fs from 'fs';

jest.spyOn(winston, 'error');
jest.mock('../../src/services/tracking', () => ({}));
jest.mock('../../src/services/redis-client', () => ({}));
jest.mock('../../src/services/flight-service');

const testFlightInfo = {
    flightNumber: 'EZY1986',
    originIata: 'MAN',
    arrivalIata: 'CPH',
    terminal: '2',
    flightArrivalTime: '2019-02-13 14:10:00.000',
    iataType: 'arrival',
};

const mockByFlightNumberSuccess = jest.fn(() => Promise.resolve(testFlightInfo));
const mockByFlightNumberFailure = jest.fn(
    () => Promise.reject(new Error('flight service error')),
);

const loadMock = mockPath => {
    const pathName = path.resolve(__dirname, `../mocks/${mockPath}.json`);
    return fs.readFileSync(pathName, 'utf8');
};

const exampleSingleJanusRate = new Rate(JSON.parse(loadMock('janus/rates-single')));

Rate.findByReference = jest.fn(() => Promise.resolve(exampleSingleJanusRate));

const exampleReturnJanusRate = new Rate(JSON.parse(loadMock('janus/rates-return')));

Rate.findByReferences = jest.fn(() => Promise.resolve(exampleReturnJanusRate));

Tracking.cloudwatch = {
    counter: {
        increment: jest.fn(),
    },
    timer: {
        add: jest.fn(),
    },
};
let reqSpy;

const setupBookingDetailsEndpoint = (isReturn, useFeatureToggles) => {
    const app = express();

    if (useFeatureToggles) {
        app.use(featureToggleMiddleware);
    }

    app.use(cookieParser())
        .use(trackingCookiesMiddleware)
        .use(bodyParser.json())
        .use((req, res, next) => {
            req.fortuna = {
                activate: jest.fn().mockReturnValue('original'),
            };
            req.session = {
                customer: {
                    sessionId: 'cust_session_id',
                    device: {
                        device_category: 'unknown',
                    },
                    locale: {
                        country: 'GB',
                        languageId: 'en-gb',
                    },
                },
            };

            req.session.bookingDetails = {
                request: {
                    carTypeID: '5',
                },
            };

            reqSpy = req;

            req.session.bookingDetails.searchRequestId = 'test_single_search_reference';

            if (isReturn) {
                req.session.bookingDetails.returnSearchRequestId = 'test_return_search_reference';
            }

            req.currencies = {
                current: {
                    id: 'test',
                },
            };
            req.currentLanguage = {
                id: 'en-gb',
            };
            req.query = {
                country: 'GB',
                token: 'testQueryToken',
            };
            res.session = req.session;
            res.trackingCookie = {
                affiliateCode: 'booking-taxi',
                campaign: '[UNDEFINED]',
                medium: '[UNDEFINED]',
            };
            res.branding = {
                details: {
                    brandKey: 'booking-taxi',
                },
            };
            next();
        })
        .use('/', legacyRoutes)
        .use(router.router);

    return app;
};

const searchOutwardRequestId = 'test_references_search_outward_request_id';
const searchReturnRequestId = 'test_references_search_reward_request_id';
const token = 'testToken';
const carTypeId = '6';
const bookingReferencesBody = {
    customerTitle: 'Miss',
    customerFirstName: 'References Test',
    customerLastName: 'References Taxi',
    customerEmail: 'references@gmail.com',
    verifyEmail: 'references@gmail.com',
    customerCellphone: ' + 44 113 496 1111',
    meetGreetCallSign: 'References Test References Taxi',
    passengerComments: 'Passenger comments',
    passengerFlightNumber: 'EZY1987',
    consentToMarketing: 'no',
};
const expectedSessionBookingDetails = {
    request: {
        carTypeID: carTypeId,
        ...bookingReferencesBody,
    },
    searchRequestId: searchOutwardRequestId,
    affiliateToken: token,
};

const runRedirectTest = (app, url, method, bookingDetailsBody, expectedRedirectPath) => {
    it(`Should redirect the ${expectedRedirectPath} page`, done => {
        request(app)[method](url)
            .send(bookingDetailsBody)
            .end((err, res) => {
                if (err) return done(err);
                expect(res.status).toBe(302);
                expect(res.header.location).toBe(expectedRedirectPath);
                done();
            });
    });
};

const runCloudWatchCounterTest = (app, url, bookingDetailsBody, counterToTest) => {
    it('Should increment a CloudWatch counter', done => {
        request(app).post(url)
            .send(bookingDetailsBody)
            .end(err => {
                if (err) return done(err);
                expect(Tracking.cloudwatch.counter.increment)
                    .toHaveBeenCalledWith(counterToTest);
                done();
            });
    });
};

const runBookingReferencesTests = (method, app, urlToQuery, isReturn) => {
    describe('When user data is sent to the endpoint', () => {
        if (method === 'post') {
            describe('When the token is passed in via the posted data', () => {
                it('Sets the data on the session', done => {
                    if (isReturn) {
                        expectedSessionBookingDetails.returnSearchRequestId
                            = searchReturnRequestId;
                    }

                    request(app)[method](urlToQuery)
                        .send({
                            token,
                            ...bookingReferencesBody,
                        })
                        .end(err => {
                            if (err) return done(err);
                            expect(
                                reqSpy.session.bookingDetails,
                            ).toEqual(
                                expectedSessionBookingDetails,
                            );
                            done();
                        });
                });
            });
        }

        describe('When the user token is passed in via query parameters', () => {
            it('Sets the data on the session', done => {
                const expectedSessionBookingDetailsWithQueryToken = {
                    request: {
                        carTypeID: carTypeId,
                        ...bookingReferencesBody,
                    },
                    searchRequestId: searchOutwardRequestId,
                    affiliateToken: 'testQueryToken',
                };

                if (isReturn) {
                    expectedSessionBookingDetailsWithQueryToken.returnSearchRequestId
                        = searchReturnRequestId;
                }

                request(app)[method](urlToQuery)
                    .send({
                        ...bookingReferencesBody,
                    })
                    .end(err => {
                        if (err) return done(err);
                        expect(
                            reqSpy.session.bookingDetails,
                        ).toEqual(
                            expectedSessionBookingDetailsWithQueryToken,
                        );
                        done();
                    });
            });
        });

        runRedirectTest(app, urlToQuery, 'get', bookingReferencesBody, '/bookingdetails');
    });
};

const runRedisGetCallTest = (app, url, bookingDetailsBody, redisMessage) => {
    it('Checks Redis for a cached selected search result', done => {
        request(app).post(url)
            .send(bookingDetailsBody)
            .end(err => {
                if (err) return done(err);
                expect(redisClient.get)
                    .toHaveBeenCalledWith(
                        redisMessage,
                    );
                done();
            });
    });
};

const runFailureTests =
    (redisOrJanus, app, url, bookingDetailsBody, expectedSessionData, expectedMessage, mockJanusReturn) => {
        describe(`When the call to ${redisOrJanus} fails`, () => {
            beforeEach(() => {
                if (redisOrJanus === 'redis') {
                    const testRedisError = new Error('some redis error');
                    redisClient.get =
                        jest.fn().mockImplementation(() => Promise.reject(testRedisError));
                } else if (redisOrJanus === 'janus') {
                    if (mockJanusReturn) {
                        const testJanusReturnError = new Error('some janus return error');
                        Rate.findByReferences =
                            jest.fn().mockImplementation(() => Promise.reject(testJanusReturnError));
                    } else {
                        const testJanusSingleError = new Error('some janus single error');
                        Rate.findByReference =
                            jest.fn().mockImplementation(() => Promise.reject(testJanusSingleError));
                    }
                }
            });

            it('Logs an error with relevant information', done => {
                request(app).post(url)
                    .send(bookingDetailsBody)
                    .end(err => {
                        if (err) return done(err);
                        expect(winston.error)
                            .toHaveBeenCalledWith(expectedMessage);
                        done();
                    });
            });

            it('Sets the information which is present on the session', done => {
                request(app).post(url)
                    .send(bookingDetailsBody)
                    .end(err => {
                        if (err) return done(err);
                        expect(reqSpy.session.bookingDetails)
                            .toEqual(expectedSessionData);
                        done();
                    });
            });

            runRedirectTest(app, url, 'post', bookingDetailsBody, '/paymentdetails');
        });
    };

const flightLookupTests = (app, url, bookingDetailsBody, expectedSessionDetails, expectedRateDetails) => {
    it('Should call the flight lookup', done => {
        request(app).post(url)
            .send(bookingDetailsBody)
            .end(err => {
                if (err) return done(err);
                expect(mockByFlightNumberSuccess)
                    .toHaveBeenCalledWith(
                        bookingDetailsBody.flightNumberInput,
                        expectedRateDetails.pickupDateTime,
                        expectedRateDetails.pickupLocation.airportCode,
                    );
                done();
            });
    });

    describe('When the flight lookup succeeds', () => {
        it('Should set the retreived flight information on the session', done => {
            request(app).post(url)
                .send(bookingDetailsBody)
                .end(err => {
                    if (err) return done(err);
                    expect(
                        reqSpy.session.bookingDetails.request.passengerFlightNumber,
                    ).toBe(
                        testFlightInfo.flightNumber,
                    );

                    expect(
                        reqSpy.session.bookingDetails.request.originIata,
                    ).toBe(
                        testFlightInfo.originIata,
                    );

                    expect(
                        reqSpy.session.bookingDetails.request.arrivalIata,
                    ).toBe(
                        testFlightInfo.arrivalIata,
                    );

                    expect(
                        reqSpy.session.bookingDetails.request.terminal,
                    ).toBe(
                        testFlightInfo.terminal,
                    );

                    expect(
                        reqSpy.session.bookingDetails.request.flightArrivalDateTime,
                    ).toBe(
                        testFlightInfo.flightArrivalDateTime,
                    );

                    expect(
                        reqSpy.session.bookingDetails.request.iataType,
                    ).toBe(
                        testFlightInfo.iataType,
                    );

                    done();
                });
        });

        runCloudWatchCounterTest(app, url, bookingDetailsBody, 'flights.byFlightNumber.success');
        runRedirectTest(app, url, 'post', bookingDetailsBody, '/paymentdetails');
    });

    describe('When the flight service lookup fails', () => {
        beforeEach(() => {
            FlightService.mockImplementation(() => ({
                byFlightNumber: mockByFlightNumberFailure,
            }));
        });

        afterEach(() => {
            FlightService.mockClear();
            mockByFlightNumberFailure.mockClear();
        });

        it('Should log a relevant error message', done => {
            request(app).post(url)
                .send(bookingDetailsBody)
                .end(err => {
                    if (err) return done(err);
                    expect(winston.error)
                        .toHaveBeenCalledWith(
                            'Error at flights.byFlightNumber: flight service error',
                        );
                    done();
                });
        });

        it('Should set the data that is present on the session still', done => {
            request(app).post(url)
                .send(bookingDetailsBody)
                .end(err => {
                    if (err) return done(err);
                    expect(reqSpy.session.bookingDetails)
                        .toEqual(
                            expectedSessionDetails,
                        );
                    done();
                });
        });

        runCloudWatchCounterTest(app, url, bookingDetailsBody, 'flights.byFlightNumber.failure');
        runRedirectTest(app, url, 'post', bookingDetailsBody, '/paymentdetails');
    });
};

describe('Booking Details API', () => {
    beforeEach(() => {
        redisClient.privateKeys = {};
        redisClient.set = (someKey, someValue) => new Promise(resolve => {
            redisClient.privateKeys[someKey] = someValue;
            resolve();
        });
        redisClient.get = jest.fn().mockImplementation(someKey => new Promise(resolve => {
            const valueToReturn = redisClient.privateKeys[someKey];
            resolve(valueToReturn);
        }));
        jest.clearAllMocks();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('#POST', () => {
        const url = '/bookingdetails';

        const bookingDetailsBody = {
            title: 'Mr',
            firstname: 'Test',
            lastname: 'Taxi',
            emailaddress: 'ridewaystestteam@gmail.com',
            verifyemailaddress: 'ridewaystestteam@gmail.com',
            contactNumber: ' + 44 113 496 0000',
            contactNumberCountry: 'GB',
            formattedContactNumber: ' + 441134960000',
            meetAndGreetMessage: 'Test Taxi',
            commentsForTheDriver: '',
            keepMeInformed: 'off',
            membershipReference: '',
            originIata: '',
            arrivalIata: '',
            flightArrivalDateTime: '',
            token,
            carTypeId,
        };

        const singleBookingDetailsBodyWithFlight = {
            ...bookingDetailsBody,
            flightNumberInput: 'EZY1986',
        };

        const returnBookingDetailsBodyWithFlight = {
            ...singleBookingDetailsBodyWithFlight,
        };

        const sessionWithoutFlightDetails = {
            bookingDetails: {
                request: {
                    affiliateCampaign: null,
                    affiliateCode: 'booking-taxi',
                    affiliateMedium: null,
                    arrivalIata: undefined,
                    carTypeID: '5',
                    consentToMarketing: false,
                    customerCellphone: ' + 441134960000',
                    customerCellphoneCountry: 'GB',
                    customerCountry: 'GB',
                    customerEmail: 'ridewaystestteam@gmail.com',
                    customerFirstName: 'Test',
                    customerIp: '::ffff:127.0.0.1',
                    customerLanguageID: 'en-gb',
                    customerLastName: 'Taxi',
                    customerTitle: 'Mr',
                    flightArrivalTime: '',
                    meetGreetCallSign: 'Test Taxi',
                    membershipReference: '',
                    originIata: '',
                    passengerComments: '',
                    passengerFlightNumber: undefined,
                    ppcCampaign: null,
                    sessionID: 'cust_session_id',
                    terminal: null,
                    verifyEmail: 'ridewaystestteam@gmail.com',
                },
                searchRequestId: 'test_single_search_reference',
            },
        };

        const singleJourneySessionBookingDetails = {
            ...sessionWithoutFlightDetails.bookingDetails,
            searchRequestId: 'test_single_search_reference',
        };

        const returnJourneySessionBookingDetails = {
            ...singleJourneySessionBookingDetails,
            returnSearchRequestId: 'test_return_search_reference',
        };

        const redisReturnSearchReference = 'rates-test_single_search_referencetest_return_search_reference';
        const redisSingleSearchReference = 'rates-test_single_search_reference';

        const errorMessagePrefix = 'Error at setCustomerDetails - findRates: Error at findRates - redisClient.get:';

        describe('/', () => {
            describe('When a flight number has been entered manually and there is no flightNumber',
                () => {
                    beforeEach(() => {
                        FlightService.mockImplementation(
                            () => (
                                {
                                    byFlightNumber: mockByFlightNumberSuccess,
                                }
                            ),
                        );
                    });

                    afterEach(() => {
                        FlightService.mockClear();
                        mockByFlightNumberSuccess.mockClear();
                    });

                    describe('When a search result has been cached into Redis', () => {
                        describe('When a single journey has been chosen', () => {
                            const singleJourneyApp = setupBookingDetailsEndpoint();

                            runRedisGetCallTest(
                                singleJourneyApp,
                                url,
                                singleBookingDetailsBodyWithFlight,
                                redisSingleSearchReference,
                            );

                            runFailureTests(
                                'redis',
                                singleJourneyApp,
                                url,
                                singleBookingDetailsBodyWithFlight,
                                singleJourneySessionBookingDetails,
                                `${errorMessagePrefix} some redis error`,
                            );

                            describe('When the call to Redis succeeds and returns the cached result', () => {
                                beforeEach(async () => {
                                    const singleTripMock = loadMock('rate-service/single-trip');
                                    await redisClient.set(
                                        redisSingleSearchReference,
                                        singleTripMock,
                                    );
                                });

                                flightLookupTests(
                                    singleJourneyApp,
                                    url,
                                    singleBookingDetailsBodyWithFlight,
                                    singleJourneySessionBookingDetails,
                                    exampleSingleJanusRate,
                                );
                            });
                        });

                        describe('When a return journey has been chosen', () => {
                            const isReturn = true;
                            const returnJourneyApp = setupBookingDetailsEndpoint(isReturn);

                            runRedisGetCallTest(
                                returnJourneyApp,
                                url,
                                returnBookingDetailsBodyWithFlight,
                                redisReturnSearchReference,
                            );

                            runFailureTests(
                                'redis',
                                returnJourneyApp,
                                url,
                                returnBookingDetailsBodyWithFlight,
                                returnJourneySessionBookingDetails,
                                `${errorMessagePrefix} some redis error`,
                            );

                            describe('When the call to Redis succeeds and returns a result', () => {
                                beforeEach(async () => {
                                    const returnTripMock = loadMock('rate-service/return-trip');
                                    await redisClient.set(
                                        redisReturnSearchReference,
                                        returnTripMock,
                                    );
                                });

                                flightLookupTests(
                                    returnJourneyApp,
                                    url,
                                    returnBookingDetailsBodyWithFlight,
                                    returnJourneySessionBookingDetails,
                                    exampleReturnJanusRate,
                                );
                            });
                        });
                    });

                    describe('When a search result has not been cached into Redis', () => {
                        describe('When a single journey has been chosen', () => {
                            beforeEach(() => {
                                redisClient.get = jest.fn(() => Promise.resolve());
                            });

                            const isReturnJourney = false;
                            const singleJourneyApp = setupBookingDetailsEndpoint(isReturnJourney);

                            runRedisGetCallTest(
                                singleJourneyApp,
                                url,
                                singleBookingDetailsBodyWithFlight,
                                redisSingleSearchReference,
                            );

                            runFailureTests(
                                'redis',
                                singleJourneyApp,
                                url,
                                singleBookingDetailsBodyWithFlight,
                                singleJourneySessionBookingDetails,
                                `${errorMessagePrefix} some redis error`,
                            );

                            describe('When the call to Redis succeeds, but a selected Rate has not been cached', () => {
                                it('Makes a call to Janus for a single search journey', done => {
                                    request(singleJourneyApp).post(url)
                                        .send(singleBookingDetailsBodyWithFlight)
                                        .end(err => {
                                            if (err) return done(err);
                                            expect(Rate.findByReference).toHaveBeenCalled();
                                            done();
                                        });
                                });

                                describe('When the call to Janus succeeds', () => {
                                    flightLookupTests(
                                        singleJourneyApp,
                                        url,
                                        singleBookingDetailsBodyWithFlight,
                                        singleJourneySessionBookingDetails,
                                        exampleSingleJanusRate,
                                    );
                                });

                                describe('When the call to Janus fails', () => {
                                    const janusSingleRateError
                                        = 'Error at findRates - Rate.findByReference: some janus single error';
                                    runFailureTests(
                                        'janus',
                                        singleJourneyApp,
                                        url,
                                        singleBookingDetailsBodyWithFlight,
                                        singleJourneySessionBookingDetails,
                                        `${errorMessagePrefix} ${janusSingleRateError}`,
                                    );
                                });
                            });
                        });

                        describe('When a return journey has been chosen', () => {
                            beforeEach(() => {
                                redisClient.get = jest.fn(() => Promise.resolve());
                            });

                            const useReturn = true;
                            const returnJourneyApp = setupBookingDetailsEndpoint(useReturn);

                            runRedisGetCallTest(
                                returnJourneyApp,
                                url,
                                returnBookingDetailsBodyWithFlight,
                                redisReturnSearchReference,
                            );

                            it('Makes a call to Janus for a return search journey', done => {
                                request(returnJourneyApp).post(url)
                                    .send(returnBookingDetailsBodyWithFlight)
                                    .end(err => {
                                        if (err) return done(err);
                                        expect(Rate.findByReferences).toHaveBeenCalled();
                                        done();
                                    });
                            });

                            describe('When the call to Janus fails', () => {
                                const mockReturnRate = true;
                                runFailureTests(
                                    'janus',
                                    returnJourneyApp,
                                    url,
                                    returnBookingDetailsBodyWithFlight,
                                    returnJourneySessionBookingDetails,
                                    `${errorMessagePrefix} Error at findRates - Rate.findByReferences: some janus return error`,
                                    mockReturnRate,
                                );
                            });

                            runFailureTests(
                                'redis',
                                returnJourneyApp,
                                url,
                                returnBookingDetailsBodyWithFlight,
                                returnJourneySessionBookingDetails,
                                `${errorMessagePrefix} some redis error`,
                            );

                            describe('When the call to Redis succeeds, but with an empty result', () => {
                                beforeEach(() => {
                                    Rate.findByReferences =
                                        jest.fn().mockImplementation(() => Promise.resolve(exampleReturnJanusRate));
                                });

                                describe('When the call to Janus succeeds', () => {
                                    flightLookupTests(
                                        returnJourneyApp,
                                        url,
                                        returnBookingDetailsBodyWithFlight,
                                        returnJourneySessionBookingDetails,
                                        exampleReturnJanusRate,
                                    );
                                });
                            });
                        });
                    });
                },
            );

            describe('When a flightNumber is present', () => {
                const app = setupBookingDetailsEndpoint(false, true);

                it('Sets the data on the session', done => {
                    request(app).post(url)
                        .send(bookingDetailsBody)
                        .end(err => {
                            if (err) return done(err);
                            expect(
                                reqSpy.session.bookingDetails,
                            ).toEqual(
                                sessionWithoutFlightDetails.bookingDetails,
                            );
                            done();
                        });
                });

                runRedirectTest(app, url, 'post', bookingDetailsBody, '/paymentdetails');
            });
        });

        describe('/:searchRequestId/:carTypeId', () => {
            const setBookingReferencesUrl =
                `/bookingdetails/${searchOutwardRequestId}/${carTypeId}`;
            const bookingReferencesApp = setupBookingDetailsEndpoint();

            runBookingReferencesTests('post', bookingReferencesApp, setBookingReferencesUrl);
        });

        describe('/outbound/:searchRequestId/return/:returnSearchRequestId/:carTypeID', () => {
            const setBookingReferencesUrl =
                `/bookingdetails/outbound/${searchOutwardRequestId}/return/${searchReturnRequestId}/${carTypeId}`;
            const bookingReferencesApp = setupBookingDetailsEndpoint();
            const isReturn = true;

            runBookingReferencesTests('post', bookingReferencesApp, setBookingReferencesUrl, isReturn);
        });
    });

    describe('#GET', () => {
        describe('/:searchRequestId/:carTypeId', () => {
            const setBookingReferencesUrl =
                `/bookingdetails/${searchOutwardRequestId}/${carTypeId}`;
            const bookingReferencesApp = setupBookingDetailsEndpoint();

            runBookingReferencesTests('get', bookingReferencesApp, setBookingReferencesUrl);
        });

        describe('/outbound/:searchRequestId/return/:returnSearchRequestId/:carTypeID', () => {
            const setBookingReferencesUrl =
                `/bookingdetails/outbound/${searchOutwardRequestId}/return/${searchReturnRequestId}/${carTypeId}`;
            const bookingReferencesApp = setupBookingDetailsEndpoint();
            const isReturn = true;

            runBookingReferencesTests('get', bookingReferencesApp, setBookingReferencesUrl, isReturn);
        });
    });
});
