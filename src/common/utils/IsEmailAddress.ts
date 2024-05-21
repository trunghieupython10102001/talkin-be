import { registerDecorator, ValidationOptions } from 'class-validator';
import isEmail from 'validator/lib/isEmail';
import { ErrorCode } from '../constants/errorcode.enum';

export function IsEmailAddress(validationOptions?: ValidationOptions) {
  return function (object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: {
        validate(value) {
          return (
            typeof value === 'string' &&
            isEmail(value, { domain_specific_validation: true })
          );
        },
        defaultMessage() {
          return ErrorCode.EMAIL_INVALID;
        },
      },
    });
  };
}
