/**
 * Shared application-level constants.
 *
 * Import from this module wherever the same value is needed in multiple layers
 * (e.g. validation middleware and route handlers) so that every layer stays in
 * sync automatically.
 */

/** Maximum number of milestones allowed per campaign. */
const MILESTONE_LIMIT = 5;

module.exports = { MILESTONE_LIMIT };
