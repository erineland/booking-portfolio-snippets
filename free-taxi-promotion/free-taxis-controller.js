import winston from 'winston';
import moment from 'moment';
import {
    Rate,
} from '@rides/data-models';

import validate from '../lib/validation/free-taxi-api';
import HttpError from '../lib/errors/http-error';
import ValidationError from '../lib/errors/validation-error';
import cryptoUtil from '../utils/crypto';
import config from '../lib/config';
import clearBookingInProgress from '../lib/free-taxi/clear-booking-in-progress';
import Tracking from '../services/tracking';
import TranslationService from '../services/translation-service';
import Flights from '../models/flights';
import CreditBooking from '../models/credit-booking';
import servicesApi from '../services/services-api';
import decyptCustomerData from '../middleware/free-taxi/decrypt-token';
import findDropoffLocation from '../middleware/free-taxi/find-dropoff-location';
import getDataLayer from '../lib/datalayer/free-taxi';
import addSession from '../middleware/session';
import checkBookingInProgress from '../middleware/free-taxi/check-booking-in-progress';
import validatePickupDate from '../middleware/free-taxi/validate-pickup-date';
import checkDateInPast from '../middleware/free-taxi/check-date-not-in-past';
import sendBookingMetaEvent from '../middleware/confirmations/send-booking-meta-event';
import sendBkngExperimentEvent from '../middleware/confirmations/send-bking-experiment-event';
import aws from 'aws-sdk';

const toConstant = string => string.split(/(?=[A-Z])/).join('_').toUpperCase();

const checkFreeTaxiPromotionToggle = (req, res, next) => {
    if (req.isFeatureEnabled('bkng-free-taxi-promotion') === false) {
        const error = new HttpError(404);
        return next(error);
    }
    next();
};

const authenticate = (req, res, next) => {
    config.valueFor('booking.freeTaxiApiKey').then(apiKey => {
        if (req.headers['x-api-key'] === apiKey) {
            next();
            return;
        }
        const customError = new HttpError(403, 'Invalid API key');
        res.status(customError.status).json(customError.formatted);
    });
};

class FreeTaxisController {
    before = [
        checkFreeTaxiPromotionToggle,
        (req, res, next) => {
            req.freeTaxi = true;
            next();
        },
        {
            run: authenticate,
            only: ['create', 'destroy'],
        },
        {
            run: decyptCustomerData,
            only: ['show', 'update'],
        },
        {
            run: checkDateInPast,
            only: ['show'],
        },
        {
            run: findDropoffLocation,
            only: ['show'],
        },
        {
            run: addSession,
            only: ['show'],
        },
        {
            run: validatePickupDate,
            only: ['update'],
        },
        {
            run: checkBookingInProgress,
            only: ['update'],
        },
    ];

    async create(req, res) {
        try {
            const requestStart = Date.now();
            const { error } = validate(req.body);

            if (error) {
                const validationError = new ValidationError();

                error.details.forEach(({ message, context: { key } }) => {
                    const code = `INVALID_PARAMETER_${toConstant(key)}`;

                    validationError.addValidationError({
                        code,
                        message,
                    });
                    Tracking.cloudwatch.counter.increment(`bkng-free-taxi.validation.failure.${code}`);
                });
                Tracking.cloudwatch.counter.increment('bkng-free-taxi.validation.failures');

                return res
                    .status(validationError.status)
                    .json(validationError.formatted);
            }

            Tracking.cloudwatch.counter.increment('bkng-free-taxi.validation.success');

            try {
                const customerDataPassphrase = await config.valueFor('booking.freeTaxiSecret');
                const userData = req.body;
                userData.timeGenerated = moment.utc().format();
                const stringifiedUserData = JSON.stringify(userData);
                const encryptedUserDataToken = cryptoUtil.cipher(stringifiedUserData, customerDataPassphrase);

                const encryptedTokenResponse = {
                    token: encryptedUserDataToken,
                    redeemUrl: `https://taxi.booking.com/${req.body.language}/promotions/free-taxi/${encryptedUserDataToken}?utm_source=booking.com&utm_medium=intra&utm_campaign=bookingfreetaxi`,
                };

                Tracking.cloudwatch.counter.increment('bkng-free-taxi.encryption.success');
                Tracking.cloudwatch.counter.increment(`bkng-free-taxi.encryption.travel-date.${req.body.pickup.date}`);

                const requestEnd = Date.now();
                const requestTime = requestEnd - requestStart;
                Tracking.cloudwatch.timer.add('bkng-free-taxi.timer.encryption', requestTime);

                return res
                    .status(200)
                    .json(encryptedTokenResponse);
            } catch (err) {
                const customError = new HttpError(500, err.message);
                Tracking.cloudwatch.counter.increment('bkng-free-taxi.encryption.failure');
                winston.error('[BKNG_FREE_TAXI_ERROR] Token encryption failed');
                winston.error(`[BKNG_FREE_TAXI_ERROR_DETAIL] message: ${err.message}`);

                return res
                    .status(customError.status)
                    .json(customError.formatted);
            }
        } catch (err) {
            const customError = new HttpError(500, 'Token encryption encountered an error');
            Tracking.cloudwatch.counter.increment('bkng-free-taxi.encryption.error');
            winston.error('[BKNG_FREE_TAXI_ERROR] Token encryption encountered an error');
            winston.error(`[BKNG_FREE_TAXI_ERROR_DETAIL] message: ${err.message}`);

            return res
                .status(customError.status)
                .json(customError.formatted);
        }
    }

    async show(req, res, next) {
        try {
            const { decryptedCustomerData } = req;

            const { pickup: { iata, date } } = decryptedCustomerData;

            const languageId = req.currentLanguage.id;
            res.translations = new TranslationService(languageId,
                ['home', 'widget', 'details', 'passenger-details', 'base', 'payment'],
            );
            await res.translations.load();
            res.title = res.translations.forKey('web.base.booktransfer');
            res.pageTitle = res.translations.forKey('web.home.pagetitle').replace('{{brand_displayName}}', res.branding.details.displayName);
            res.subtitle = res.translations.forKey('web.base.companydescription');
            res.pickupLocation = iata;
            res.pickupTime = date;
            res.customerBookingDetails = {
                customerTitle: decryptedCustomerData.passenger.title,
                customerFirstName: decryptedCustomerData.passenger.firstName,
                customerLastName: decryptedCustomerData.passenger.lastName,
                customerEmail: decryptedCustomerData.passenger.email,
                verifyEmail: decryptedCustomerData.passenger.email,
                customerCellphone: decryptedCustomerData.passenger.phone,
            };
            res.dataLayer = 'dataLayer/freetaxi';
            res.journeyDetails = getDataLayer(req, res);

            try {
                const hoursForward = 12;
                const hoursBehind = 12;
                const flights = await Flights.find(iata, `${date} 12Z`, hoursForward, hoursBehind);
                if (Object.keys(flights.all).length === 0 || flights.all.error) {
                    throw new Error('No flight results found');
                }
                res.flights = flights.all;
            } catch (err) {
                const badRequestError = new HttpError(400, 'Flight lookup failed');
                Tracking.cloudwatch.counter.increment('bkng-free-taxi.flight-lookup.failure');
                winston.error('[BKNG_FREE_TAXI_ERROR] Flight lookup failed');
                winston.error(`[BKNG_FREE_TAXI_ERROR_DETAIL] message: ${err.message}; token: ${req.params.id}`);
                return next(badRequestError);
            }

            res.customerBookingToken = req.params.id;

            const composition = await res.compose('free-taxi-promotion');
            Tracking.cloudwatch.counter.increment('bkng-free-taxi.render.success');

            res.render('free-taxi-promotion', {
                ...res,
                ...composition,
            });
        } catch (err) {
            const customError = new HttpError(500, 'Free Taxi redeem page failed to render');
            Tracking.cloudwatch.counter.increment('bkng-free-taxi.render.error');
            winston.error('[BKNG_FREE_TAXI_ERROR] Free Taxi redeem page failed to render');
            winston.error(`[BKNG_FREE_TAXI_ERROR_DETAIL] message: ${err.message}; token: ${req.params.id}`);
            return next(customError);
        }
    }

    async update(req, res) {
        try {
            const requestStart = Date.now();

            const { id: token } = req.params;
            const { decryptedCustomerData, body } = req;
            const {
                affiliateBookingReference: affiliateReference,
                language,
                timeGenerated,
                pickup: {
                    iata,
                    passengers,
                    date,
                },
                dropoff: {
                    lat,
                    lng,
                    hotelName,
                },
            } = decryptedCustomerData;
            const {
                title,
                firstName,
                lastName,
                email,
                phone: cellphone,
                flightArrivalDateTime,
                flightNumber: passengerFlightNumber,
            } = body;
            let rate;

            const searchStart = Date.now();

            const errorDetails = {
                method: 'PUT',
                path: `/promotions/free-taxi/${token}`,
            };

            const sendErrorResponse = async error => {
                Tracking.cloudwatch.counter.increment('bkng-free-taxi.redeem.failure');
                await clearBookingInProgress(req);
                res
                    .status(error.status)
                    .json(error.formatted);
            };
            const elibibilityApi = `/v2/bookings/affiliate-ref/${decryptedCustomerData.affiliateBookingReference}`;
            let freeTaxiEligible;

            try {
                const eligibilityResponse = await servicesApi.get(elibibilityApi, {
                    headers: {
                        affiliateCode: 'bookingfreetaxi',
                    },
                });
                ({ freeTaxiEligible } = eligibilityResponse);
                Tracking.cloudwatch.counter.increment('bkng-free-taxi.eligibility.success');
            } catch (err) {
                const badRequestError = new HttpError(400, 'Eligibility check failed', errorDetails);
                winston.error('[BKNG_FREE_TAXI_ERROR] Eligibility check failed');
                winston.error(`[BKNG_FREE_TAXI_ERROR_DETAIL] message: ${err.message}; token: ${req.params.id}`);
                Tracking.cloudwatch.counter.increment('bkng-free-taxi.eligibility.failure');
                return sendErrorResponse(badRequestError);
            }

            if (!freeTaxiEligible) {
                const validationError = new ValidationError(400, 'Eligibility validation failed', errorDetails);
                validationError.addValidationError({
                    code: 'FREE_TAXI_ALREADY_REDEEMED',
                    message: 'This affiliate booking reference has already redeemed a free taxi',
                });
                winston.error('[BKNG_FREE_TAXI_ERROR] Affiliate booking reference already redeemed');
                winston.error(`[BKNG_FREE_TAXI_ERROR_DETAIL] token: ${req.params.id}`);
                Tracking.cloudwatch.counter.increment('bkng-free-taxi.eligibility.not-eligible');
                return sendErrorResponse(validationError);
            }

            Tracking.cloudwatch.counter.increment('bkng-free-taxi.eligibility.eligible');

            try {
                rate = await Rate.find({
                    pickup: iata,
                    pickupdatetime: flightArrivalDateTime,
                    dropoff: `${lat},${lng}`,
                    dropoffestablishment: hotelName,
                    affiliate: 'bookingfreetaxi',
                    passenger: passengers,
                });
            } catch (err) {
                const badRequestError = new HttpError(400, 'Search request failed', errorDetails);
                winston.error('[BKNG_FREE_TAXI_ERROR] Search request failed');
                winston.error(`[BKNG_FREE_TAXI_ERROR_DETAIL] message: ${err.message}; token: ${req.params.id}`);
                Tracking.cloudwatch.counter.increment('bkng-free-taxi.search.failure');
                return sendErrorResponse(badRequestError);
            }

            const searchEnd = Date.now();
            const searchTime = searchEnd - searchStart;
            Tracking.cloudwatch.timer.add('bkng-free-taxi.timer.search', searchTime);
            Tracking.cloudwatch.counter.increment('bkng-free-taxi.search.success');

            if (rate.results.length === 0) {
                const badRequestError = new HttpError(400, 'No results found for search', errorDetails);
                winston.error('[BKNG_FREE_TAXI_ERROR] No results found for search');
                winston.error(`[BKNG_FREE_TAXI_ERROR_DETAIL] searchReference: ${rate.id}; token: ${req.params.id}`);
                Tracking.cloudwatch.counter.increment('bkng-free-taxi.search.no-results');
                return sendErrorResponse(badRequestError);
            }

            const booking = new CreditBooking({
                customerCurrency: 'EUR',
                resultReference: rate.cheapestTaxi.id,
                affiliate: 'bookingfreetaxi',
                affiliateReference,
                passenger: {
                    title,
                    firstName,
                    lastName,
                    email,
                    cellphone,
                    language,
                    consentToMarketing: false,
                },
                searchRequestId: rate.id,
                journeys: {
                    outward: {
                        pickupDateTime: flightArrivalDateTime,
                    },
                    cellphone,
                    language,
                    consentToMarketing: false,
                },
                passengerFlightNumber,
            });

            const bookingStart = Date.now();

            try {
                await booking.save();
            } catch (err) {
                const badRequestError = new HttpError(400, 'Booking request failed', errorDetails);
                winston.error('[BKNG_FREE_TAXI_ERROR] Booking request failed');
                winston.error(`[BKNG_FREE_TAXI_ERROR_DETAIL] message: ${err.message}; token: ${req.params.id}`);
                Tracking.cloudwatch.counter.increment('bkng-free-taxi.booking.failure');
                return sendErrorResponse(badRequestError);
            }

            const bookingEnd = Date.now();
            const bookingTime = bookingEnd - bookingStart;
            Tracking.cloudwatch.timer.add('bkng-free-taxi.timer.book', bookingTime);

            const redemptionTimeBeforeTravel = moment.utc(date).diff(moment.utc());
            Tracking.cloudwatch.timer.add('bkng-free-taxi.timer.token-redemption-to-travel', redemptionTimeBeforeTravel);

            if (timeGenerated) {
                const redemptionTime = moment.utc().diff(moment.utc(timeGenerated));
                Tracking.cloudwatch.timer.add('bkng-free-taxi.timer.token-generation-to-redemption', redemptionTime);
            }

            req.session.booking = booking;
            await sendBookingMetaEvent(req, res, () => { });
            await sendBkngExperimentEvent(req, res, () => { });

            const totalRequestTime = bookingEnd - requestStart;
            Tracking.cloudwatch.timer.add('bkng-free-taxi.timer.search-book-total', totalRequestTime);
            Tracking.cloudwatch.counter.increment('bkng-free-taxi.redeem.success');
            Tracking.cloudwatch.counter.increment(`bkng-free-taxi.redeem.travel-date.${date}`);

            await clearBookingInProgress(req);
            res.json({
                bookingReference: booking.reference,
            });
        } catch (err) {
            const customError = new HttpError(500, 'Search and book request encountered an error');
            Tracking.cloudwatch.counter.increment('bkng-free-taxi.redeem.error');
            winston.error('[BKNG_FREE_TAXI_ERROR] Search and book request encountered an error');
            winston.error(`[BKNG_FREE_TAXI_ERROR_DETAIL] message: ${err.message}; token: ${req.params.id}`);

            await clearBookingInProgress(req);
            return res
                .status(customError.status)
                .json(customError.formatted);
        }
    }

    async destroy(req, res) {
        const fakeBookingReference = '123456';

        // Talk to Dynamo DB here!
        const dynamoDb = new aws.DynamoDB({
            // eslint-disable-next-line quote-props
            'region': 'us-west-2',
        },
        );

        winston.info('FREE TAXI CANCELLATION ENDPOINT CALLED.');

        dynamoDb.putItem({
            Item: {
                BcomReference: {
                    S: fakeBookingReference,
                },
                PickupDate: {
                    S: 'Mon Jul 01 2019 13:50:51 GMT+0000 (Coordinated Universal Time)',
                },
            },
            TableName: 'free_taxi_promotion',
        }, (err, data) => {
            if (err) {
                winston.error(err.stack); // an error occurred
                return res
                    .status(500)
                    .json(err);
            } else {
                winston.info(data);
                // Write a record...

                // THen read it back

                // If it all works, we are go go go.
                return res
                    .status(200)
                    .json(data);
            }
        });
    }
}

export default new FreeTaxisController();
