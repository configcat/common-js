export type WellKnownUserObjectAttribute = "Identifier" | "Email" | "Country";

export type UserAttributeValue = string | number | Date | ReadonlyArray<string>;

/** User Object. Contains user attributes which are used for evaluating targeting rules and percentage options. */
export class User {
  constructor(
    /** The unique identifier of the user or session (e.g. email address, primary key, session ID, etc.) */
    public identifier: string,
    /** Email address of the user. */
    public email?: string,
    /** Country of the user. */
    public country?: string,
    /** Custom attributes of the user for advanced targeting rule definitions (e.g. user role, subscription type, etc.) */
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
