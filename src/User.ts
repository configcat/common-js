import { isStringArray } from "./RolloutEvaluator";

export type WellKnownUserObjectAttribute = "Identifier" | "Email" | "Country";

/** User Object. Contains user attributes which are used for evaluating targeting rules and percentage options. */
export class User {
  /**
   * Converts the specified `Date` value to the format expected by datetime comparison operators (BEFORE/AFTER).
   * @param date The `Date` value to convert.
   * @returns The User Object attribute value in the expected format.
  */
  static attributeValueFromDate(date: Date): string {
    if (!(date instanceof Date)) {
      throw new Error("Invalid 'date' value");
    }

    const unixTimeSeconds = date.getTime() / 1000;
    return unixTimeSeconds + "";
  }

  /**
   * Converts the specified `number` value to the format expected by number comparison operators.
   * @param number The `number` value to convert.
   * @returns The User Object attribute value in the expected format.
  */
  static attributeValueFromNumber(number: number): string {
    if (typeof number !== "number" || !isFinite(number)) {
      throw new Error("Invalid 'date' value");
    }

    return number + "";
  }

  /**
   * Converts the specified `string` items to the format expected by array comparison operators (ARRAY CONTAINS ANY OF/ARRAY NOT CONTAINS ANY OF).
   * @param items The `string` items to convert.
   * @returns The User Object attribute value in the expected format.
  */
  static attributeValueFromStringArray(...items: ReadonlyArray<string>): string {
    if (!isStringArray(items)) {
      throw new Error("Invalid 'items' value");
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
    public custom: { [key: string]: string } = {}
  ) {
  }
}

// NOTE: This could be an instance method of the User class, however formerly we suggested `const user = { ... }`-style initialization in the SDK docs,
// which would lead to "...is not a function" errors if we called functions on instances created that way as those don't have the correct prototype.
export function getUserAttributes(user: User): { [key: string]: string } {
  // TODO: https://trello.com/c/A3DDpqYU
  const result: { [key: string]: string } = {};

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
    for (const attributeName of Object.keys(user.custom)) {
      if (wellKnownAttributes.indexOf(attributeName) < 0) {
        result[attributeName] = user.custom[attributeName];
      }
    }
  }

  return result;
}
