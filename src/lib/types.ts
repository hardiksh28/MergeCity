export type Tier = "free" | "founder" | "team";

export type Headwear =
  | "none"
  | "short"
  | "spiky"
  | "mohawk"
  | "cap"
  | "beanie"
  | "halo";

export interface Look {
  outfit: string; // hex
  skin: string; // hex
  head: Headwear;
}

/** What the whole city is allowed to see. Never includes email. */
export interface PublicResident {
  id: string;
  handle: string; // name on the door
  github: string | null;
  look: Look;
  tier: Tier;
  floors: number;
  plotId: string;
  joinedAt: number;
  place: number; // place in line
}

/** Only ever held by the resident themselves (and the server). */
export interface Me extends PublicResident {
  email: string;
  refCode: string;
  referrals: number;
  lastSeen?: { at: number; residents: number; floors: number; tier: Tier };
}

export interface Team {
  id: string;
  name: string;
  towerId: string;
  seats: number;
  ownerId: string | null;
}

export interface JoinInput {
  email: string;
  github: string;
  handle: string;
  look: Look;
  ref: string | null;
}
