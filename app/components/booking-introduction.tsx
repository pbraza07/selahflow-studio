'use client';

import {createContext, useContext, type ReactNode} from 'react';

type BookingIntroduction = {name: string; description: string; profile: string};
const Introduction = createContext<BookingIntroduction | null>(null);
export function BookingIntroductionProvider({value, children}: {value: BookingIntroduction; children: ReactNode}) {
  return <Introduction.Provider value={value}>{children}</Introduction.Provider>;
}
export function useBookingIntroduction() {
  return useContext(Introduction);
}
