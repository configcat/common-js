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
     * All comparators support `string` values as User Object attribute (in some cases they need to be provided in a specific format though, see below),
     * but some of them also support other types of values. It depends on the comparator how the values will be handled. The following rules apply:
     *
     * **Text-based comparators** (EQUALS, IS ONE OF, etc.)
     * * accept `string` values,
     * * all other values are automatically converted to `string` (a warning will be logged but evaluation will continue as normal).
     *
     * **SemVer-based comparators** (IS ONE OF, &lt;, &gt;=, etc.)
     * * accept `string` values containing a properly formatted, valid semver value,
     * * all other values are considered invalid (a warning will be logged and the currently evaluated targeting rule will be skipped).
     *
     * **Number-based comparators** (=, &lt;, &gt;=, etc.)
     * * accept `number` values,
     * * accept `string` values containing a properly formatted, valid `number` value,
     * * all other values are considered invalid (a warning will be logged and the currently evaluated targeting rule will be skipped).
     *
     * **Date time-based comparators** (BEFORE / AFTER)
     * * accept `Date` values, which are automatically converted to a second-based Unix timestamp,
     * * accept `number` values representing a second-based Unix timestamp,
     * * accept `string` values containing a properly formatted, valid `number` value,
     * * all other values are considered invalid (a warning will be logged and the currently evaluated targeting rule will be skipped).
     *
     * **String array-based comparators** (ARRAY CONTAINS ANY OF / ARRAY NOT CONTAINS ANY OF)
     * * accept arrays of `string`,
     * * accept `string` values containing a valid JSON string which can be deserialized to an array of `string`,
     * * all other values are considered invalid (a warning will be logged and the currently evaluated targeting rule will be skipped).
     **/
    public custom: { [key: string]: UserAttributeValue } = {}
  ) {
  }
}

// NOTE: These functions could be instance methods of the User class, however formerly we suggested `const user = { ... }`-style initialization in the SDK docs,
// which would lead to "...is not a function" errors if we called functions on instances created that way as those don't have the correct prototype.

export function getUserAttribute(user: User, name: string): UserAttributeValue | null | undefined {
  switch (name) {
    case <WellKnownUserObjectAttribute>"Identifier": return user.identifier ?? "";
    case <WellKnownUserObjectAttribute>"Email": return user.email;
    case <WellKnownUserObjectAttribute>"Country": return user.country;
    default: return user.custom?.[name];
  }
}

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
