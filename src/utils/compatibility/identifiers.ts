/**
 * Validates if a given string is a valid 24-character hexadecimal MongoDB ObjectId.
 */
export const isMongoObjectId = (id: string): boolean => {
  if (!id) return false;
  return /^[a-f\d]{24}$/i.test(id);
};

/**
 * Validates if a given string is a valid UUID (used by Prisma Postgres).
 */
export const isUUID = (id: string): boolean => {
  if (!id) return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
};

/**
 * Determines the correct Prisma where clause key for a given identifier.
 * This is crucial for the transition period where frontend URLs might still
 * contain legacy Mongo _id strings instead of new UUIDs.
 * 
 * @param id The identifier string from the client (e.g. from req.params.id)
 * @returns An object to be spread into a Prisma `where` clause.
 */
export const getPrismaLookupKey = (id: string): { id: string } | { mongoId: string } => {
  if (isUUID(id)) {
    return { id };
  }
  return { mongoId: id };
};
