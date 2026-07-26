"use client";

import { createContext, useContext } from "react";
import type { CurrentMembership } from "@/lib/auth/membership";

const MembershipContext = createContext<CurrentMembership | null>(null);

export function MembershipProvider({
  membership,
  children
}: {
  membership: CurrentMembership;
  children: React.ReactNode;
}) {
  return <MembershipContext.Provider value={membership}>{children}</MembershipContext.Provider>;
}

export function useMembership(): CurrentMembership {
  const ctx = useContext(MembershipContext);
  if (!ctx) {
    throw new Error("useMembership skal bruges inden i MembershipProvider (dvs. under /(app)).");
  }
  return ctx;
}
