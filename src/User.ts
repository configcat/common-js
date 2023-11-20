export type WellKnownUserObjectAttribute = "Identifier" | "Email" | "Country";

export type UserAttributeValue = string | number | Date | ReadonlyArray<string>;

/**
 * User Object. Contains user attributes which are used for evaluating targeting rules and percentage options.
 * @remarks
 * Please note that the `User` class is not designed to be used as a DTO (data transfer object).
 * (Since the type of the `custom` property is polymorphic, it's not guaranteed that deserializing a serialized instance produces an instance with an identical or even valid data content.)
 **/
export class User {
  constructor(
    /** The unique identifier of the user or session (e.g. email address, primary key, session ID, etc.) */
    public identifier: string,
    /** Email address of the user. */
    public email?: string,
    /** Country of the user. */
    public country?: string,
    /**
     * Custom attributes of the user for advanced targeting rule definitions (e.g. user role, subscription type, etc.)
     * @remarks
     * The set of allowed attribute values depends on the comparison type of the condition which references the User Object attribute.
     * `string` values are supported by all comparison types (in some cases they need to be provided in a specific format though).
     * Some of the comparison types work with other types of values, as descibed below.
     *
     * Text-based comparisons (EQUALS, IS ONE OF, etc.)<br/>
     * * accept `string` values,<br/>
     * * all other values are automatically converted to string (a warning will be logged but evaluation will continue as normal).
     *
     * SemVer-based comparisons (IS ONE OF, &lt;, &gt;=, etc.)<br/>
     * * accept `string` values containing a properly formatted, valid semver value,<br/>
     * * all other values are considered invalid (a warning will be logged and the currently evaluated targeting rule will be skipped).
     *
     * Number-based comparisons (=, &lt;, &gt;=, etc.)<br/>
     * * accept `number` values,<br/>
     * * accept `string` values containing a properly formatted, valid `number` value,<br/>
     * * all other values are considered invalid (a warning will be logged and the currently evaluated targeting rule will be skipped).
     *
     * Date time-based comparisons (BEFORE / AFTER)<br/>
     * * accept `Date` values, which are automatically converted to a second-based Unix timestamp,<br/>
     * * accept `number` values representing a second-based Unix timestamp,<br/>
     * * accept `string` values containing a properly formatted, valid `number` value,<br/>
     * * all other values are considered invalid (a warning will be logged and the currently evaluated targeting rule will be skipped).
     *
     * String array-based comparisons (ARRAY CONTAINS ANY OF / ARRAY NOT CONTAINS ANY OF)<br/>
     * * accept arrays of `string`,<br/>
     * * accept `string` values containing a valid JSON string which can be deserialized to an array of `string`,<br/>
     * * all other values are considered invalid (a warning will be logged and the currently evaluated targeting rule will be skipped).
     *
     * In case a non-string attribute value needs to be converted to `string` during evaluation, it will always be done using the same format
     * which is accepted by the comparisons.
     **/
    public custom: { [key: string]: UserAttributeValue } = {}
  ) {
  }
}

// NOTE: This could be an instance method of the User class, however formerly we suggested `const user = { ... }`-style initialization in the SDK docs,
// which would lead to "...is not a function" errors if we called functions on instances created that way as those don't have the correct prototype.
export function getUserAttributes(user: User): { [key: string]: UserAttributeValue } {

  const result: { [key: string]: UserAttributeValue } = {};

  const identifierAttribute: WellKnownUserObjectAttribute = "Identifier";
  const emailAttribute: WellKnownUserObjectAttribute = "Email";
  const countryAttribute: WellKnownUserObjectAttribute = "Country";

  result[identifierAttribute] = user.identifier ?? "";

  if (user.email != null) {
    result[emailAttribute] = user.email;
  }

  if (user.country != null) {
    result[countryAttribute] = user.country;
  }

  if (user.custom != null) {
    const wellKnownAttributes: string[] = [identifierAttribute, emailAttribute, countryAttribute];
    for (const [attributeName, attributeValue] of Object.entries(user.custom)) {
      if (attributeValue != null && wellKnownAttributes.indexOf(attributeName) < 0) {
        result[attributeName] = attributeValue;
      }
    }
  }

  return result;
}
