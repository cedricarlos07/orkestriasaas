import { createAccessControl } from "better-auth/plugins/access";
import { defaultStatements, adminAc } from "better-auth/plugins/admin/access";
import { defaultStatements as orgDefaultStatements } from "better-auth/plugins/organization/access";

const orgStatement = {
  ...orgDefaultStatements,
  campaign: ["create", "read", "update", "delete"],
  run: ["create", "read", "update", "cancel"],
} as const;

export const orgAc = createAccessControl(orgStatement);

export const orgOwner = orgAc.newRole({
  campaign: ["create", "read", "update", "delete"],
  run: ["create", "read", "update", "cancel"],
  organization: ["update", "delete"],
  member: ["create", "update", "delete"],
  invitation: ["create", "cancel"],
});

export const orgAdmin = orgAc.newRole({
  campaign: ["create", "read", "update", "delete"],
  run: ["create", "read", "update", "cancel"],
  organization: ["update"],
  member: ["create", "update", "delete"],
  invitation: ["create", "cancel"],
});

export const mediaBuyer = orgAc.newRole({
  campaign: ["create", "read", "update", "delete"],
  run: ["create", "read", "update"],
  organization: [],
  member: ["read"],
  invitation: [],
});

export const analyst = orgAc.newRole({
  campaign: ["read"],
  run: ["read"],
  organization: [],
  member: ["read"],
  invitation: [],
});

export const viewer = orgAc.newRole({
  campaign: ["read"],
  run: ["read"],
  organization: [],
  member: ["read"],
  invitation: [],
});

export const orgRoles = {
  owner: orgOwner,
  admin: orgAdmin,
  media_buyer: mediaBuyer,
  analyst,
  viewer,
};

const adminStatement = {
  ...defaultStatements,
} as const;

export const ac = createAccessControl(adminStatement);

export const superAdminRole = ac.newRole({
  ...adminAc.statements,
});

export const adminRoles = {
  super_admin: superAdminRole,
  user: ac.newRole({}),
};
