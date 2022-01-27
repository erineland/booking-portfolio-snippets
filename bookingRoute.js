import express from 'express';
import {
    Rate,
} from '@rides/data-models';
import passengerValidation from '../lib/validation/passenger-validation';
import FlightService from '../services/flight-service';
import Tracking from '../services/tracking';
import winston from 'winston';
import ratesAdapter from '../adapters/rates-adapter';
import redisClient from '../services/redis-client';

const router = express.Router();

const IP = require('../utils/ip').default;

const findRates = async req => {
    if (req.session.bookingDetails.hasOwnProperty('returnSearchRequestId')) {
        const outwardSearchRequestId = req.session.bookingDetails.searchRequestId;
        const { returnSearchRequestId } = req.session.bookingDetails;

        try {
            const retrievedRates = await redisClient.get(`rates-${outwardSearchRequestId}${returnSearchRequestId}`);
            if (retrievedRates) {
                return JSON.parse(retrievedRates);
            } else {
                try {
                    const retrievedRate = await Rate.findByReferences(
                        req.session.bookingDetails.searchRequestId,
                        req.session.bookingDetails.returnSearchRequestId,
                    );
                    const formattedRate = ratesAdapter(retrievedRate);
                    return formattedRate;
                } catch (error) {
                    const findRatesError = new Error(`Error at findRates - Rate.findByReferences: ${error.message}`);
                    winston.error(findRatesError.message);
                    throw findRatesError;
                }
            }
        } catch (error) {
            const redisCheckReturnSearchError = new Error(`Error at findRates - redisClient.get: ${error.message}`);
            throw redisCheckReturnSearchError;
        }
    } else {
        try {
            const singleSearchReference = req.session.bookingDetails.searchRequestId;
            let retrievedRate = await redisClient.get(`rates-${singleSearchReference}`);
            if (retrievedRate) {
                return JSON.parse(retrievedRate);
            } else {
                try {
                    retrievedRate = await Rate.findByReference(
                        req.session.bookingDetails.searchRequestId,
                    );
                    const formattedRate = ratesAdapter(retrievedRate);
                    return formattedRate;
                } catch (error) {
                    const findRatesError = new Error(`Error at findRates - Rate.findByReference: ${error.message}`);
                    throw findRatesError;
                }
            }
        } catch (error) {
            const redisCheckSingleSearchError = new Error(`Error at findRates - redisClient.get: ${error.message}`);
            throw redisCheckSingleSearchError;
        }
    }
};

function requestBodyOverrides(requestBody) {
    const whitelistedFields = [
        'customerTitle',
        'customerFirstName',
        'customerLastName',
        'customerEmail',
        'verifyEmail',
        'customerCellphone',
        'meetGreetCallSign',
        'passengerComments',
        'passengerFlightNumber',
        'consentToMarketing',
    ];
    const reducedObject = whitelistedFields.reduce((acc, curr) => {
        if (requestBody[curr]) {
            return {
                ...acc,
                [curr]: requestBody[curr],
            };
        }
        return acc;
    }, {});

    return reducedObject;
}

function setBookingReferences(req, res) {
    const { searchRequestId, returnSearchRequestId, carTypeID } = req.params;
    const token = req.body.token || req.query.token;
    let customerDetails = {};

    if (req.session.bookingDetails && req.session.bookingDetails.request) {
        customerDetails = req.session.bookingDetails.request;

        if (searchRequestId !== req.session.bookingDetails.searchRequestId) {
            customerDetails.passengerFlightNumber = null;
        }
    }

    if (req.body) {
        customerDetails = {
            ...customerDetails,
            ...requestBodyOverrides(req.body),
        };
    }

    req.session.bookingDetails = {
        request: {
            ...customerDetails,
            carTypeID,
        },
        searchRequestId,
        affiliateToken: token,
        returnSearchRequestId,
    };

    if (req.query.redirectTo === 'paymentdetails') {
        return res.redirect('/paymentdetails');
    }

    return res.redirect('/bookingdetails');
}

function validPassengerDetails(passenger) {
    if (passengerValidation.required(passenger.customerTitle) === false) {
        return false;
    }
    if (passengerValidation.required(passenger.customerFirstName) === false) {
        return false;
    }
    if (passengerValidation.required(passenger.customerLastName) === false) {
        return false;
    }
    if (passengerValidation.email(passenger.customerEmail) === false) {
        return false;
    }
    if (passengerValidation.cellphone(passenger.customerCellphone) === false) {
        return false;
    }

    return true;
}

const setCustomerDetails = async (req, res) => {
    const trackingSources = res.trackingCookie;
    const customerDetails = req.body;
    const bookingRequest = {
        carTypeID: req.session.bookingDetails.request.carTypeID,
        customerIp: IP.getRemote(req),
        customerCountry: req.session.customer.locale.country,
        customerTitle: customerDetails.title,
        customerFirstName: customerDetails.firstname,
        customerLastName: customerDetails.lastname,
        customerEmail: customerDetails.emailaddress,
        verifyEmail: customerDetails.verifyemailaddress,
        customerCellphone: customerDetails.formattedContactNumber,
        customerCellphoneCountry: customerDetails.contactNumberCountry.toUpperCase(),
        customerLanguageID: req.session.customer.locale.languageId,
        consentToMarketing: customerDetails.keepMeInformed === 'on',
        meetGreetCallSign: customerDetails.meetAndGreetMessage,
        passengerFlightNumber: customerDetails.flightNumber,
        membershipReference: customerDetails.membershipReference,
        terminal: customerDetails.terminal || null,
        originIata: customerDetails.originIata,
        arrivalIata: customerDetails.arrivalAirport,
        flightArrivalTime: customerDetails.flightArrivalDateTime,
        passengerComments: customerDetails.commentsForTheDriver,
        sessionID: req.session.customer.sessionId,
        affiliateCode: trackingSources.affiliateCode,
        affiliateCampaign: (trackingSources.campaign === '[UNDEFINED]') ? null : trackingSources.campaign,
        ppcCampaign: (trackingSources.campaign === '[UNDEFINED]') ? null : trackingSources.campaign,
        affiliateMedium: (trackingSources.medium === '[UNDEFINED]') ? null : trackingSources.medium,
    };

    const passengerDetailsExperiment = req.fortuna.activate(
        'passenger-details-redesign',
        req.session.customer.sessionId,
        {
            toggle: 'passenger-details-redesign',
            lang: 'en-gb',
        },
    ) === 'experiment';

    if (passengerDetailsExperiment) {
        bookingRequest.customerFirstName = customerDetails.firstName;
        bookingRequest.customerLastName = customerDetails.lastName;
        bookingRequest.customerEmail = customerDetails.email;
        bookingRequest.passengerComments = customerDetails.passengerComments;

        if (validPassengerDetails(bookingRequest) === false) {
            req.session.bookingDetails.failedSubmission = true;
            req.session.bookingDetails.request = bookingRequest;
            return res.redirect('/bookingdetails');
        }
        req.session.bookingDetails.failedSubmission = false;
    }

    req.session.bookingDetails.request = bookingRequest;

    if (customerDetails.flightNumberInput && customerDetails.hasOwnProperty('flightNumber') === false) {
        try {
            const rates = await findRates(req, res);
            const flightNumber = customerDetails.flightNumberInput.replace(/ /gi, '');
            const pickupDate = rates.outward.requestedPickupDateTime;
            const pickupIata = rates.outward.pickupLocation.airportCode;
            const flights = new FlightService();

            try {
                const flightInfo = await flights.byFlightNumber(flightNumber, pickupDate, pickupIata);
                req.session.bookingDetails.request = Object.assign(bookingRequest, {
                    passengerFlightNumber: flightInfo.flightNumber,
                    originIata: flightInfo.originIata,
                    arrivalIata: flightInfo.arrivalIata,
                    terminal: flightInfo.terminal,
                    flightArrivalTime: flightInfo.flightArrivalTime,
                    iataType: 'arrival',
                });
                Tracking.cloudwatch.counter.increment('flights.byFlightNumber.success');
                return res.redirect('/paymentdetails');
            } catch (error) {
                const flightNumberLookupError = new Error(`Error at flights.byFlightNumber: ${error.message}`);
                winston.error(flightNumberLookupError.message);
                req.session.bookingDetails.request = bookingRequest;
                Tracking.cloudwatch.counter.increment('flights.byFlightNumber.failure');
                return res.redirect('/paymentdetails');
            }
        } catch (error) {
            const findRatesError = new Error(`Error at setCustomerDetails - findRates: ${error.message}`);
            winston.error(findRatesError.message);
            req.session.bookingDetails.request = bookingRequest;
            return res.redirect('/paymentdetails');
        }
    }

    return res.redirect('/paymentdetails');
};

router.get([
    '/outbound/:searchRequestId/return/:returnSearchRequestId/:carTypeID',
    '/:searchRequestId/:carTypeID',
], setBookingReferences);

router.post([
    '/outbound/:searchRequestId/return/:returnSearchRequestId/:carTypeID',
    '/:searchRequestId/:carTypeID',
], setBookingReferences);

router.post('/', setCustomerDetails);

module.exports = router;
