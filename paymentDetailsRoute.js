import {
    Rate,
    Fraud,
} from '@rides/data-models';
import express from 'express';
import requestClient from 'request-promise-native';
import winston from 'winston';
import moment from 'moment';
import config from '../lib/config';
import Components from '../components';
import SearchLinkService from '../services/search-link-service';
import SupplierLocationService from '../services/supplier-location-service';
import PlacesService from '../services/places-service';
import PaymentService from '../services/payment-service';
import Booking from '../models/booking';
import Tracking from '../services/tracking';
import Poll from '../lib/poll';
import ratesAdapter from '../adapters/rates-adapter';
import HttpError from '../lib/errors/http-error';
import isPaymentNonceValid from '../utils/isPaymentNonceValid';

const router = express.Router();

const twentyFiveSeconds = (25 * 1000);
const TWO_MINUTES = ((2 * 60) * 1000);


function addBookingProgressComponent(req, res, translations, rates) {
    const searchLink = req.session.searchUuid ? `/search/${req.session.searchUuid}` : SearchLinkService.fromRates(rates);
    const activeStep = 'payment-details';
    const links = [
        {
            id: 'search-results',
            text: translations.forKey('web.base.progressearch'),
            href: searchLink,
            translationKey: 'web.base.progressearch',
        },
        {
            id: 'booking-details',
            href: '/bookingdetails',
            text: translations.forKey('web.base.progressdetails'),
            translationKey: 'web.base.progressdetails',
        },
        {
            id: 'payment-details',
            text: translations.forKey('web.base.progrespayment'),
            translationKey: 'web.base.progrespayment',
        },
    ];
    const activeStepIndex = links.map(data => data.id).indexOf(activeStep);
    const component = Components.getBookingProgress({
        links,
        activeStep,
        activeStepIndex,
        previousPageURL: '/bookingdetails',
        backButton: translations.forKey('web.base.progress-back'),
        stepIndicator: translations.forKeyWithReplacement(
            'web.base.progress-step-indicator',
            {
                '{0}': activeStepIndex + 1,
                '{1}': links.length,
            },
        ),
    });

    res.bookingProgress = component;
}

async function addPaymentDetails(req, res, translations, authToken, purchaseId) {
    const renderPaymentAndBookingProgress = rates => {
        res.rates = rates;
        function filterSelected(query, currentRates) {
            return currentRates.results.filter(el => el.resultReference === query)[0];
        }
        addBookingProgressComponent(req, res, translations, rates);
        const componentRates = {
            page: 'payment',
            outward: rates.outward,
        };
        if (rates.hasOwnProperty('return')) {
            componentRates.return = rates.return;
        }
        const currentRates = (rates.return === undefined) ? rates.outward : rates.return;
        const selectedResult = filterSelected(req.session.bookingDetails.request.carTypeID, currentRates);
        const { bags, supplierTransportReference, meetAndGreet, publicTransport, type } = selectedResult;
        req.session.additionalBookingDetails = {
            bags,
            supplierTransportReference,
            isMeetAndGreet: meetAndGreet,
            isPublicTransport: publicTransport,
            type,
        };
        return SupplierLocationService.find(selectedResult.supplierLocationId).then(supplier => {
            const experiment = res.renderBookingComponent ? 'payment-booking' : 'payment-details';
            res.paymentDetails = Components.renderPaymentExperiment(
                req, res, experiment, authToken, translations, supplier.terms, purchaseId,
            );
            const passengerDetailsRedesign = req.fortuna.activate('passenger-details-redesign', req.session.customer.sessionId, {
                lang: 'en-gb',
                toggle: 'passenger-details-redesign',
            }) === 'experiment';

            res.bookingSummary = passengerDetailsRedesign
                ? Components.getNewBookingSummary(req, res)
                : Components.getBookingSummary(req, res, res.rates, translations, 'payment');
        }).catch(error => {
            throw new Error(
                `Error at SupplierLocationService.find: ${error.message}`,
            );
        });
    };

    if (req.session.bookingDetails.hasOwnProperty('returnSearchRequestId')) {
        try {
            const retrievedRate = await Rate.findByReferences(
                req.session.bookingDetails.searchRequestId,
                req.session.bookingDetails.returnSearchRequestId,
            );
            const formattedRate = ratesAdapter(retrievedRate);
            return renderPaymentAndBookingProgress(formattedRate);
        } catch (error) {
            throw new Error(
                `Error at Rate.findByReferences: ${error.message}`,
            );
        }
    } else {
        try {
            const retrievedRate = await Rate.findByReference(req.session.bookingDetails.searchRequestId);
            const formattedRate = ratesAdapter(retrievedRate);
            return renderPaymentAndBookingProgress(formattedRate);
        } catch (error) {
            throw new Error(
                `Error at Rate.findByReference: ${error.message}`,
            );
        }
    }
}

function addHeader(req, res, translations, showMenuOptions) {
    res.header = Components.getHeader(req, res, translations, showMenuOptions);
}

function addBenefits(req, res, translations) {
    res.benefits = Components.getBenefits(req, res, translations);
}

const bookingProcessing = booking => {
    const startTime = Date.now();
    return Poll.until(() => (
        new Promise((resolve, reject) => {
            booking.isProcessing().then(processing => {
                if (processing) {
                    reject(new Error('Processing'));
                    return;
                }
                const processingTime = Date.now() - startTime;
                Tracking.cloudwatch.timer.add('bookings.v2.processingTime', processingTime);
                resolve();
            }).catch(() => reject());
        })
    ), {
        timeout: TWO_MINUTES,
        delay: 1000,
    }).catch(err => {
        Tracking.cloudwatch.counter.increment('bookings.v2.timeout');
        winston.error(`Booking request timed out for: ${booking.reference}`);
        return err;
    });
};

function responseTime(then) {
    const now = +new Date();
    const tokenResponseTime = (now - then) / 1000;

    winston.info(`Janus token response time: ${tokenResponseTime}s`);
}

function janusApiCredentials() {
    return Promise.all([
        config.valueFor('hosts.janus.url'),
        config.valueFor('hosts.janus.apiKey'),
    ]).then(([url, apiKey]) => ({
        url,
        apiKey,
    }));
}

function getToken(bookingId) {
    let lastError;
    const doRequest = (attempt = 0) => {
        const then = +new Date();
        return janusApiCredentials().then(janus => (
            requestClient.get(`${janus.url}/v1/booking/${bookingId}/status`, {
                json: true,
                qs: {
                    apikey: janus.apiKey,
                },
                timeout: twentyFiveSeconds,
            }).then(response => {
                responseTime(then);
                return requestClient.get(`${janus.url}/v2/bookings/${response.tripId}`, {
                    json: true,
                    qs: {
                        apikey: janus.apiKey,
                    },
                    timeout: twentyFiveSeconds,
                });
            }).then(response => {
                Tracking.cloudwatch.counter.increment('booking.token.success');
                return response.journeys[0].legs[0].token;
            }).catch(e => {
                responseTime(then);

                if (attempt < 4) {
                    lastError = e.message;
                    return doRequest((attempt + 1));
                }

                winston.warn(`Failed to get token after 5 attempts. Last error received: ${lastError}`);
                Tracking.cloudwatch.counter.increment('booking.token.failure');
                return false;
            })
        ));
    };
    return doRequest();
}

export async function setPaymentNonce(req, res) {
    req.clearTimeout();

    const { body: { paymentNonce }, session: { bookingDetails } } = req;

    const validatePaymentNonceEnabled = req.isFeatureEnabled('validate-payment-nonce');
    if (validatePaymentNonceEnabled) {
        const paymentNonceValid = isPaymentNonceValid(paymentNonce);

        if (!paymentNonceValid) {
            const invalidPaymentNonceError = new HttpError(400, `Invalid payment nonce: ${paymentNonce}`);
            winston.error('[BKNG_PAYMENT_ERROR] An invalid payment nonce received from client');
            winston.error(`[BKNG_PAYMENT_ERROR_DETAIL] An invalid payment nonce received from client: paymentNonce: ${JSON.stringify(invalidPaymentNonceError.formatted)}`);
            Tracking.cloudwatch.counter.increment('bkng.payment.set-payment-nonce.invalid-payment-nonce');
            return res.status(invalidPaymentNonceError.status).send({
                success: false,
            });
        }
    }

    winston.info(`Payment Nonce: ${paymentNonce}`);

    const isJanusV2 = req.session.customer.janusApiVersion === 'v2';

    if (isJanusV2) {
        const {
            searchRequestId,
            returnSearchRequestId,
            request,
        } = bookingDetails;
        const {
            affiliateCode: affiliate,
            customerTitle: title,
            customerFirstName: firstName,
            customerLastName: lastName,
            customerEmail: email,
            customerCellphone: cellphone,
            customerLanguageID: language,
            carTypeID: resultReference,
            consentToMarketing,
            meetGreetCallSign,
            passengerComments,
            passengerFlightNumber,
            flightArrivalTime,
        } = request;
        const {
            bags,
            supplierTransportReference,
            isMeetAndGreet,
            isPublicTransport,
            type,
        } = req.session.additionalBookingDetails;
        const bookingParams = {
            paymentNonce,
            affiliate,
            searchRequestId,
            returnSearchRequestId,
            resultReference,
            meetGreetCallSign,
            passengerComments,
            bags,
            supplierTransportReference,
            isMeetAndGreet,
            isPublicTransport,
            type,
            passengerFlightNumber,
            flightArrivalTime,
            passenger: {
                affiliate,
                title,
                firstName,
                lastName,
                email,
                cellphone,
                language,
                consentToMarketing,
            },
        };
        if (req.body.deviceData) {
            bookingParams.deviceData = req.body.deviceData;
        }
        const retrievedRate = returnSearchRequestId
            ? await Rate.findByReferences(searchRequestId, returnSearchRequestId)
            : await Rate.findByReference(searchRequestId);

        const taxiDetailsOutward = retrievedRate.legResults.find(result =>
            result.id === bookingParams.resultReference,
        );

        bookingParams.customerTotalPrice = parseFloat(taxiDetailsOutward.price.value);
        bookingParams.customerCurrency = req.currencies.current.id;
        bookingParams.numPassengers = retrievedRate.passengers;
        bookingParams.outboundLeg = {
            arrivalAirportCode: retrievedRate.pickupLocation.airportCode,
            priceRuleID: taxiDetailsOutward.result.priceRuleID,
            price: taxiDetailsOutward.price.value,
            requestedPickupDateTime: new Date(retrievedRate.pickupDateTime).toISOString(),
            pickupLocation: {
                locationId: retrievedRate.pickupLocation.id,
                country: retrievedRate.pickupLocation.country,
                timezone: retrievedRate.pickupLocation.timezone,
                establishment: retrievedRate.pickupLocation.establishment,
                name: retrievedRate.pickupLocation.name,
            },
            dropoffLocation: {
                locationId: retrievedRate.dropoffLocation.id,
                country: retrievedRate.dropoffLocation.country,
                establishment: retrievedRate.dropoffLocation.establishment,
                name: retrievedRate.dropoffLocation.name,
            },
        };

        if (returnSearchRequestId) {
            const taxiDetailsReturn = retrievedRate.return.legResults.find(result =>
                result.id === bookingParams.resultReference,
            );

            bookingParams.customerTotalPrice += parseFloat(taxiDetailsReturn.price.value);
            bookingParams.inboundLeg = {
                arrivalAirportCode: retrievedRate.return.pickupLocation.airportCode,
                priceRuleID: taxiDetailsReturn.result.priceRuleID,
                price: taxiDetailsReturn.price.value,
                requestedPickupDateTime: new Date(retrievedRate.return.pickupDateTime).toISOString(),
                pickupLocation: {
                    locationId: retrievedRate.return.pickupLocation.id,
                    country: retrievedRate.return.pickupLocation.country,
                    timezone: retrievedRate.return.pickupLocation.timezone,
                    establishment: retrievedRate.return.pickupLocation.establishment,
                    name: retrievedRate.return.pickupLocation.name,
                },
                dropoffLocation: {
                    locationId: retrievedRate.return.dropoffLocation.id,
                    country: retrievedRate.return.dropoffLocation.country,
                    establishment: retrievedRate.return.dropoffLocation.establishment,
                    name: retrievedRate.return.dropoffLocation.name,
                },
            };
        }

        bookingParams.customerTotalPrice = parseFloat(bookingParams.customerTotalPrice.toFixed(2));

        const booking = new Booking(bookingParams);
        booking.save().then(async bookingReference => {
            winston.info(`PAYMENT SUCCESS, bookingReference: ${bookingReference}`);
            await bookingProcessing(booking);
            req.session.bookingParams = booking.exportParams();
            res.send({
                success: true,
            });
            req.fortuna.track({
                eventCategory: 'booking',
                eventAction: 'complete',
            }, req.session.customer.sessionId);
        }).catch(err => {
            winston.error(`PAYMENT FAILURE, reason: ${err.message}`);
            res.status(402).send({
                success: false,
            });
        });
    } else {
        bookingDetails.paymentNonce = paymentNonce;
        if (req.body.deviceData) {
            bookingDetails.deviceData = req.body.deviceData;
        }
        janusApiCredentials().then(janus => (
            requestClient.post(`${janus.url}/v1/booking/process`, {
                json: true,
                body: bookingDetails,
                headers: {
                    apikey: janus.apiKey,
                },
                timeout: twentyFiveSeconds,
            }).then(async response => {
                const token = await getToken(response.outboundBookingId);
                Tracking.cloudwatch.counter.increment('payment.auth.success');
                winston.info('Received response from JANUS for PAYMENT');
                req.session.bookingConfirmation = {
                    ...response,
                    token,
                };
                res.send({
                    success: true,
                });
                req.fortuna.track({
                    eventCategory: 'booking',
                    eventAction: 'complete',
                }, req.session.customer.sessionId);
            }).catch(e => {
                Tracking.cloudwatch.counter.increment('payment.auth.failure');
                winston.error('PAYMENT ERROR');
                winston.error(e.response.body);
                res.status(e.response.statusCode).send({
                    success: false,
                });
            })
        ));
    }
}

function realTokenFailureError(error) {
    const errorMessage = error.message;

    if (
        !errorMessage ||
        errorMessage.indexOf('SupplierLocationService.find') > -1 ||
        errorMessage.indexOf('Rate.findByReference') > -1
    ) {
        return false;
    } else {
        return true;
    }
}

function googleDataLayer(req, res) {
    const { rates } = res;
    const isNotReturn = rates.return === undefined;
    const currentRates = isNotReturn ? rates.outward : rates.return;
    const customerBookingDetails = req.session.bookingDetails.request;
    const selectedVehicle = currentRates.results.filter(el => (
        el.resultReference === customerBookingDetails.carTypeID
    ))[0];
    return Promise.all([
        PlacesService.searchById(rates.outward.pickupLocation.locationId, req.session.customer.locale.languageId),
        PlacesService.searchById(rates.outward.dropoffLocation.locationId, req.session.customer.locale.languageId),
    ]).then(results => {
        const pickupTime = moment(rates.outward.requestedPickupDateTime);
        const returnPickupTime = isNotReturn ? 'undefined' : moment(rates.return.requestedPickupDateTime);
        res.dataLayer = 'dataLayer/payment';
        res.journeyDetails = {
            originAirport: rates.outward.pickupLocation.airportCode || 'undefined',
            destinationAirport: rates.outward.dropoffLocation.airportCode || 'undefined',
            pickupCity: rates.outward.pickupLocation.city,
            pickupCountryCity: `${rates.outward.pickupLocation.city} ${rates.outward.pickupLocation.country}`,
            dropoffCity: rates.outward.dropoffLocation.city,
            dropoffCountryCity: `${rates.outward.dropoffLocation.city} ${rates.outward.dropoffLocation.country}`,
            dropoffDate: pickupTime.format('YYYY-MM-DD'),
            numPax: rates.outward.passenger,
            pickupLocationType: results[0].types[0],
            dropoffLocationType: results[1].types[0],
            puTime: moment(rates.outward.requestedPickupDateTime).format('HH-mm'),
            distance: rates.outward.drivingDistance,
            productType: selectedVehicle.type[0],
            productTypeName: selectedVehicle.carDetails.description,
            id: `${rates.outward.dropoffLocation.locationId}${res.rwSession.locale.languageId}${selectedVehicle.description}`,
            meetAndGreet: selectedVehicle.meetAndGreet,
            returnDate: isNotReturn ? 'undefined' : returnPickupTime.format('YYYY-MM-DD'),
            returnTime: isNotReturn ? 'undefined' : returnPickupTime.format('HH-mm'),
        };
        return true;
    });
}

function ecommerceTracking(req, res) {
    res.ecommercePartial = 'ecommerce/payment';
    const { rates } = res;
    const isReturn = rates.hasOwnProperty('return');
    const customerBookingDetails = req.session.bookingDetails.request;
    let returnSelectedVehicle;

    if (isReturn) {
        /* eslint-disable max-len */
        [returnSelectedVehicle] = rates.return.results.filter(el => el.resultReference === customerBookingDetails.carTypeID);
    }
    const outwardSelectedVehicle = rates.outward.results.filter(el => el.resultReference === customerBookingDetails.carTypeID)[0];
    res.journeyDetails.price = isReturn ? (parseFloat(outwardSelectedVehicle.price, 10) + parseFloat(returnSelectedVehicle.price)).toFixed(2) : parseFloat(outwardSelectedVehicle.price).toFixed(2);
}

function createView(req, res) {
    winston.info(`SUCCESS: Rendering ${req.originalUrl}`);
    if (req.query.error) {
        res.paymentError = true;
    }
    ecommerceTracking(req, res);
    res.render('paymentdetails', res);
}

function renderComponents(req, res) {
    if (!req.session.hasOwnProperty('bookingDetails') || !req.session.bookingDetails.hasOwnProperty('searchRequestId')) {
        Tracking.cloudwatch.counter.increment('sessionExpired.paymentDetails');
        res.redirect('/');
    }

    const currencyId = req.currencies.current.id;

    let paymentServiceConfig = {
        provider: 'braintree',
        currency: currencyId,
    };

    if (res.renderBookingComponent) {
        const fraudParams = new Fraud(res.pendingBooking, {
            fraud: {
                note_to_driver: req.session.bookingDetails.request.passengerComments,
            },
        });

        paymentServiceConfig = {
            ...paymentServiceConfig,
            isDev: (config.currentEnv() !== 'prod'),
            provider: 'booking',
            amount: res.pendingBooking.result.price.toFixed(),
            customer: {
                firstName: res.pendingBooking.passenger.firstName,
                lastName: res.pendingBooking.passenger.lastName,
                emailAddress: res.pendingBooking.passenger.email,
                phoneNumber: res.pendingBooking.passenger.cellphone,
            },
            productSpecificFraudParams: {
                line_items: fraudParams.line_items,
            },
        };
    }

    const token = new PaymentService(paymentServiceConfig);

    return token.getToken().then(authToken => {
        let purchaseId;
        if (res.renderBookingComponent) {
            purchaseId = token.getPurchaseId();

            res.cookie(
                token.getCookieName(),
                token.getPayerId(),
                {
                    domain: '.booking.com',
                },
            );
        }

        Tracking.cloudwatch.counter.increment('payment.token.success');

        addHeader(req, res, res.translations, false);
        addBenefits(req, res, res.translations);

        return addPaymentDetails(req, res, res.translations, authToken, purchaseId);
    }).catch(error => {
        if (realTokenFailureError(error)) {
            Tracking.cloudwatch.counter.increment('payment.token.failure');
        }
        throw new Error(`Error PaymentService.getToken: ${error.message}`);
    });
}

export function render(req, res, next) {
    Tracking.cloudwatch.counter.increment('website.page.paymentDetails');
    res.rwSession = req.session.customer;
    res.currentLanguage = req.currentLanguage;

    return renderComponents(req, res).then(() => {
        res.footerComponent = Components.getFooter(req, res, res.translations);
        res.pageTitle = res.translations.forKey('web.payment.pagetitle').replace(
            '{{brand_displayName}}', res.branding.details.displayName,
        );
        res.allTranslations = res.translations.all();

        return googleDataLayer(req, res)
            .then(() => {
                createView(req, res);
            }).catch(error => {
                throw new Error(`Error in googleDataLayer: ${error.message}`);
            });
    }).catch(error => {
        winston.error(
            `Error in paymentDetailsRoute renderComponents: ${error.message}`,
        );
        return next(error);
    });
}

export default router;
export {
    addBookingProgressComponent,
};
