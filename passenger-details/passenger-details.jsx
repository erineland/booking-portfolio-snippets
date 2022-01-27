import React, {
    Component,
} from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import Translation from '../translation';
import PhoneInput from '../input-phone';
import BookingActions from '../../actions/booking-actions';
import BookingStore from '../../stores/booking-store';
import Tracking from '../../utils/tracking';

export default class PassengerDetails extends Component {
    constructor(props) {
        super(props);
        this.state = BookingStore.getState();
        this.inputClasses = this.inputClasses.bind(this);
        this.renderError = this.renderError.bind(this);
        this.bookingStoreUpdated = this.bookingStoreUpdated.bind(this);
        this.trackFieldFocus = this.trackFieldFocus.bind(this);
    }
    componentDidMount() {
        BookingStore.listen(this.bookingStoreUpdated);
        BookingActions.updateWithParams({
            ...this.props.values,
            contactNumber: undefined,
        });
    }
    inputClasses(element, type) {
        const isInvalid = this.state.errors.indexOf(element) > -1;
        const isDirty = this.state.dirty.indexOf(element) > -1;
        if (type === 'input') {
            return classNames({
                'rw-form__input--valid': !isInvalid && (isDirty || this.state.submitted),
                'rw-form__input--invalid': isInvalid && (isDirty || this.state.submitted),
            });
        } else if (type === 'select') {
            return classNames('rw-select__wrapper', {
                'rw-select__wrapper--valid': !isInvalid && (isDirty || this.state.submitted),
                'rw-select__wrapper--invalid': isInvalid && (isDirty || this.state.submitted),
            });
        }
    }
    renderError = fieldName => {
        if (this.state.errors.indexOf(fieldName) > -1 && this.state.submitted) {
            return <div className="rw-form__error" data-test="form-error">{this.props.errors[fieldName]}</div>;
        }
    }
    componentWillUnmount() {
        BookingStore.unlisten(this.bookingStoreUpdated);
    }
    bookingStoreUpdated(state) {
        this.setState(state);
    }
    trackFieldFocus(e) {
        Tracking.track('ux', 'booking-details.form-focus', e.target.name);
    }
    renderOptions(fieldOptions) {
        return fieldOptions.map((option, index) => (
            <option value={option} key={`option-${index}`}>
                {option}
            </option>
        ));
    }
    render() {
        const { labels } = this.props;

        return (
            <fieldset className='rw-e-fieldset gb-u-mb++ gb-u-p+ gb-u-position-relative' data-test="passenger-details">
                {!this.state.promotionalBookingCompleted &&
                    <span
                        data-test="almost-done-required-info-label"
                        className={
                            classNames(
                                'rw-c-passenger-details__required-info-label',
                                'gb-u-p-',
                                'gb-u-display-none',
                                'gb-u-display-flex@m',
                                'gb-u-display-flex@l',
                                'gb-u-element-align-center',
                                'gb-u-element-justify-center',
                            )
                        }
                    >
                        <Translation translationKey="web.base.required-info-almost-done-label">
                            {labels.almostDoneRequiredLabel}
                        </Translation>
                    </span>
                }
                <header
                    className={
                        classNames(
                            'rw-e-header',
                            'gb-u-mb++@l',
                            'gb-u-mb+',
                        )
                    }
                    data-test="passenger-details-group-heading"
                >
                    <Translation translationKey={labels.passengerDetailsYourDetailsTitleTranslationx}>
                        {labels.passengerDetailsYourDetailsTitleLabel}
                    </Translation>
                </header>
                <div className="ui-2/3@m ui-1/2@l">
                    <Translation translationKey={labels.passengerTitleTranslation}>
                        <label
                            className={
                                classNames(
                                    'gb-u-mt+',
                                    'rw-e-label',
                                    'gb-u-display-block',
                                    'rw-e-label--required',
                                )
                            }
                            htmlFor="title"
                        >
                            {labels.passengerTitle}
                        </label>
                    </Translation>
                    <div
                        className={
                            classNames(
                                'rw-e-input',
                                'rw-e-input--select',
                                'gb-u-display-flex',
                                'gb-u-element-align-center',
                                this.inputClasses('title', 'select'),
                            )
                        }
                    >
                        <select
                            data-test="passenger-details-title-input"
                            className="gb-u-display-block gb-u-p rw-e-select"
                            id="title"
                            type="text"
                            name="title"
                            value={this.state.title}
                            onChange={BookingActions.updateValue}
                            onFocus={this.trackFieldFocus}
                        >
                            {this.renderOptions(this.props.fields.title)}
                        </select>
                    </div>
                    <Translation translationKey={labels.firstnameTranslation}>
                        <label
                            className={
                                classNames(
                                    'gb-u-mt+',
                                    'rw-e-label',
                                    'gb-u-display-block',
                                    'rw-e-label--required',
                                )
                            }
                            htmlFor="firstname"
                        >
                            {labels.firstname}
                        </label>
                    </Translation>
                    <input
                        data-test="passenger-details-firstname-input"
                        className={
                            classNames(
                                'rw-e-input',
                                'gb-u-p',
                                this.inputClasses('firstname', 'input'),
                            )
                        }
                        maxLength="50"
                        type="text"
                        id="firstname"
                        name="firstname"
                        onChange={BookingActions.updateValue}
                        onFocus={this.trackFieldFocus}
                        value={this.state.firstname}
                    />
                    {this.renderError('firstname')}
                    <Translation translationKey={labels.lastnameTranslation}>
                        <label
                            className={
                                classNames(
                                    'gb-u-mt+',
                                    'rw-e-label',
                                    'gb-u-display-block',
                                    'rw-e-label--required',
                                )
                            }
                            htmlFor="lastname"
                        >
                            {labels.lastname}
                        </label>
                    </Translation>
                    <input
                        data-test="passenger-details-lastname-input"
                        className={
                            classNames(
                                'rw-e-input',
                                'gb-u-p',
                                this.inputClasses('lastname', 'input'),
                            )
                        }
                        maxLength="50"
                        type="text"
                        id="lastname"
                        name="lastname"
                        onChange={BookingActions.updateValue}
                        onFocus={this.trackFieldFocus}
                        value={this.state.lastname}
                    />
                    {this.renderError('lastname')}
                    <Translation translationKey={labels.emailaddressTranslation}>
                        <label
                            className={
                                classNames(
                                    'gb-u-mt+',
                                    'rw-e-label',
                                    'gb-u-display-block',
                                    'rw-e-label--required',
                                )
                            }
                            htmlFor="emailaddress"
                        >
                            {labels.emailaddress}
                        </label>
                    </Translation>
                    <input
                        data-test="passenger-details-emailaddress-input"
                        type="email"
                        className={
                            classNames(
                                'rw-e-input',
                                'gb-u-p',
                                this.inputClasses('emailaddress', 'input'),
                            )
                        }
                        maxLength="50"
                        id="emailaddress"
                        name="emailaddress"
                        onChange={BookingActions.updateValue}
                        onFocus={this.trackFieldFocus}
                        value={this.state.emailaddress}
                    />
                    {this.renderError('emailaddress')}
                    <Translation translationKey={labels.verifyemailaddressTranslation}>
                        <label
                            className={
                                classNames(
                                    'gb-u-mt+',
                                    'rw-e-label',
                                    'gb-u-display-block',
                                    'rw-e-label--required',
                                )
                            }
                            htmlFor="verifyemailaddress"
                        >
                            {labels.verifyemailaddress}
                        </label>
                    </Translation>
                    <input
                        data-test="passenger-details-verifyemailaddress-input"
                        type="email"
                        className={
                            classNames(
                                'rw-e-input',
                                'gb-u-p',
                                this.inputClasses('verifyemailaddress', 'input'),
                            )
                        }
                        maxLength="50"
                        id="verifyemailaddress"
                        name="verifyemailaddress"
                        onFocus={this.trackFieldFocus}
                        onChange={BookingActions.updateValue}
                        value={this.state.verifyemailaddress}
                    />
                    {this.renderError('verifyemailaddress')}
                    <PhoneInput
                        data-test="passenger-details-contact-number-input"
                        labels={labels.phone}
                        country={this.props.country}
                        id="contactNumber"
                        name="contactNumber"
                        onChange={BookingActions.phoneNumberUpdated}
                        handleFormattedPhoneNumber={this.props.handleFormattedPhoneNumber}
                        onFocus={this.trackFieldFocus}
                        value={this.props.values.contactNumber}
                        required
                        submitted={this.state.submitted}
                        showPromptIcon={false}
                        showPrompt***REMOVED***eathField={true}
                        labelClassOverrides="rw-c-passenger-details__contact-phone-number-field-label"
                        requiredLabelClassOverrides="rw-c-passenger-details__field-label--required"
                        containerClassNames="gb-u-pt++ gb-u-mt++ rw-c-passenger-details__contact-phone-number-field-container"
                        countrySelectClassOverrides="gb-u-p gb-u-pl+ rw-c-passenger-details__field-phone-input-country-select-btn"
                        phoneInputClassOverrides="rw-c-passenger-details__field-input rw-c-passenger-details__contact-phone-number-field-input"
                        promptClasses="gb-u-mt+ rw-c-passenger-details__field-mobile-phone-prompt"
                        usePromptContentOverride={true}
                        prefixSelectorAccessibleText={this.props.labels.prefixSelectorAccessibleText}
                    />
                    {this.renderError('contactNumber')}
                </div>
            </fieldset>
        );
    }
}

PassengerDetails.defaultProps = {
    values: {},
};

PassengerDetails.propTypes = {
    fields: PropTypes.object,
    errors: PropTypes.object,
    handleFormattedPhoneNumber: PropTypes.func,
    labels: PropTypes.object,
    values: PropTypes.object,
    country: PropTypes.string,
};
