import { defineRelations } from "drizzle-orm";
import {
  account,
  presenceSnapshots,
  roomMemberSettings,
  roomMemberships,
  rooms,
  session,
  user,
  verification,
} from "./schema.js";

export const relations = defineRelations(
  {
    user,
    session,
    account,
    verification,
    rooms,
    roomMemberships,
    roomMemberSettings,
    presenceSnapshots,
  },
  (r) => ({
    user: {
      sessions: r.many.session(),
      accounts: r.many.account(),
      ownedRooms: r.many.rooms(),
      memberships: r.many.roomMemberships(),
      memberSettings: r.many.roomMemberSettings(),
      presenceSnapshots: r.many.presenceSnapshots(),
    },
    session: {
      user: r.one.user({
        from: r.session.userId,
        to: r.user.id,
      }),
    },
    account: {
      user: r.one.user({
        from: r.account.userId,
        to: r.user.id,
      }),
    },
    rooms: {
      ownerUser: r.one.user({
        from: r.rooms.ownerUserId,
        to: r.user.id,
      }),
      memberships: r.many.roomMemberships({
        from: r.rooms.id,
        to: r.roomMemberships.roomId,
      }),
      memberSettings: r.many.roomMemberSettings({
        from: r.rooms.id,
        to: r.roomMemberSettings.roomId,
      }),
    },
    roomMemberships: {
      room: r.one.rooms({
        from: r.roomMemberships.roomId,
        to: r.rooms.id,
      }),
      user: r.one.user({
        from: r.roomMemberships.userId,
        to: r.user.id,
      }),
    },
    roomMemberSettings: {
      room: r.one.rooms({
        from: r.roomMemberSettings.roomId,
        to: r.rooms.id,
      }),
      user: r.one.user({
        from: r.roomMemberSettings.userId,
        to: r.user.id,
      }),
    },
    presenceSnapshots: {
      user: r.one.user({
        from: r.presenceSnapshots.userId,
        to: r.user.id,
      }),
    },
  }),
);
