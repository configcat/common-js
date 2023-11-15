import { isStringArray } from "./RolloutEvaluator";

export type WellKnownUserObjectAttribute = "Identifier" | "Email" | "Country";

/** User Object. Contains user attributes which are used for evaluating targeting rules and percentage options. */
export class User {
  /**
   * Converts the specified `Date` value to the format expected by datetime comparison operators (BEFORE/AFTER).
   * @param date The `Date` value to convert.
   * @returns The User Object attribute value in the expected format.
   * Please note that if a value other than `Date` is passed to the method, the return value will be `undefined`.
  */
  static attributeValueFromDate(date: Date): string | undefined {
    if (!(date instanceof Date)) {
      return;
    }

    const unixTimeSeconds = date.getTime() / 1000;
    return unixTimeSeconds + "";
  }

  /**
   * Converts the specified `number` value to the format expected by number comparison operators.
   * @param number The `number` value to convert.
   * @returns The User Object attribute value in the expected format.
   * Please note that if a value other than `number` is passed to the method, the return value will be `undefined`.
  */
  static attributeValueFromNumber(number: number): string | undefined {
    if (typeof number !== "number" || isNaN(number)) {
      return;
    }

    return number + "";
  }

  /**
   * Converts the specified `string` items to the format expected by array comparison operators (ARRAY CONTAINS ANY OF/ARRAY NOT CONTAINS ANY OF).
   * @param items The `string` items to convert.
   * @returns The User Object attribute value in the expected format.
   * Please note that if items other than `string` values are passed to the method, the return value will be `undefined`.
  */
  static attributeValueFromStringArray(...items: ReadonlyArray<string>): string | undefined {
    if (!isStringArray(items)) {
      return;
    }

    return JSON.stringify(items);
  }

  constructor(
    /** The unique identifier of the user or session (e.g. email address, primary key, session ID, etc.) */
    public identifier: string,
    /** Email address of the user. */
    public email?: string,
    /** Country of the user. */
    public country?: string,
    /** Custom attributes of the user for advanced targeting rule definitions (e.g. user role, subscription type, etc.) */
    public custom: { [key: string]: string | undefined } = {}
  ) {
  }
}

// NOTE: This could be an instance method of the User class, however formerly we suggested `const user = { ... }`-style initialization in the SDK docs,
// which would lead to "...is not a function" errors if we called functions on instances created that way as those don't have the correct prototype.
export function getUserAttributes(user: User, typeMismatches?: string[]): { [key: string]: string } {

  function setAttribute(result: { [key: string]: string }, name: string, value: NonNullable<unknown>, typeMismatches?: string[]) {
    result[name] = typeof value === "string"
      ? value
      : (typeMismatches?.push(name), value + "");
  }

  const result: { [key: string]: string } = {};

  const identifierAttribute: WellKnownUserObjectAttribute = "Identifier";
  const emailAttribute: WellKnownUserObjectAttribute = "Email";
  const countryAttribute: WellKnownUserObjectAttribute = "Country";

  setAttribute(result, identifierAttribute, user.identifier ?? "", typeMismatches);

  if (user.email != null) {
    setAttribute(result, emailAttribute, user.email, typeMismatches);
  }

  if (user.country != null) {
    setAttribute(result, countryAttribute, user.country, typeMismatches);
  }

  if (user.custom != null) {
    const wellKnownAttributes: string[] = [identifierAttribute, emailAttribute, countryAttribute];
    for (const [attributeName, attributeValue] of Object.entries(user.custom)) {
      if (attributeValue != null && wellKnownAttributes.indexOf(attributeName) < 0) {
        setAttribute(result, attributeName, attributeValue, typeMismatches);
      }
    }
  }

  return result;
}
