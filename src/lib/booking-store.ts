import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  cancelBooking as cancelBookingFn,
  createBooking,
  getBookingConfig,
  listBookings as fetchBookings,
  saveBookingConfig,
} from "@/functions/booking";

export type AvailabilityConfig = {
  timezone: string;
  durationMin: number;
  bufferMin: number;
  workingDays: number[];
  startHour: number;
  endHour: number;
};

export type Booking = {
  id: string;
  name: string;
  email: string;
  company?: string;
  topic: string;
  message?: string;
  startISO: string;
  endISO: string;
  status: string;
  createdAt?: string;
};

export function useBookingConfig() {
  return useQuery({
    queryKey: ["booking-config"],
    queryFn: () => getBookingConfig(),
  });
}

export function useBookings() {
  const qc = useQueryClient();
  const { data: list = [] } = useQuery({
    queryKey: ["bookings"],
    queryFn: async () => {
      const rows = await fetchBookings();
      return rows.map((b) => ({
        id: b.id,
        name: b.name,
        email: b.email,
        company: b.company ?? undefined,
        topic: b.topic,
        message: b.message ?? undefined,
        startISO: b.startIso.toISOString(),
        endISO: b.endIso.toISOString(),
        status: b.status ?? "confirmed",
      }));
    },
  });

  const createMut = useMutation({
    mutationFn: createBooking,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bookings"] }),
  });

  const cancelMut = useMutation({
    mutationFn: (id: string) => cancelBookingFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bookings"] }),
  });

  const saveConfigMut = useMutation({
    mutationFn: saveBookingConfig,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["booking-config"] }),
  });

  return { list, create: createMut.mutateAsync, cancel: cancelMut.mutate, saveConfig: saveConfigMut.mutateAsync };
}

export function saveBooking(b: Booking) {
  _bookingsCache = [b, ..._bookingsCache.filter((x) => x.id !== b.id)];
  void createBooking({
    data: {
      name: b.name,
      email: b.email,
      company: b.company,
      topic: b.topic,
      message: b.message,
      startIso: b.startISO,
      endIso: b.endISO,
    },
  });
}

export function availableDates(cfg: AvailabilityConfig, bookings: Booking[]): Date[] {
  const out: Date[] = [];
  const now = new Date();
  for (let i = 0; i < 42; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    const wd = d.getDay();
    if (!(cfg.workingDays as number[]).includes(wd)) continue;
    out.push(new Date(d.getFullYear(), d.getMonth(), d.getDate()));
  }
  void bookings;
  return out;
}

export function daySlots(day: Date, cfg: AvailabilityConfig, bookings: Booking[]): Date[] {
  const slots: Date[] = [];
  const start = new Date(day);
  start.setHours(cfg.startHour, 0, 0, 0);
  const end = new Date(day);
  end.setHours(cfg.endHour, 0, 0, 0);
  for (let t = start.getTime(); t + cfg.durationMin * 60_000 <= end.getTime(); t += (cfg.durationMin + cfg.bufferMin) * 60_000) {
    const slot = new Date(t);
    const taken = bookings.some((b) => {
      const s = new Date(b.startISO).getTime();
      return Math.abs(s - slot.getTime()) < cfg.durationMin * 60_000;
    });
    if (!taken && slot.getTime() > Date.now()) slots.push(slot);
  }
  return slots;
}

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export const DEFAULT_CONFIG: AvailabilityConfig = {
  timezone: "Africa/Abidjan",
  durationMin: 30,
  bufferMin: 10,
  workingDays: [1, 2, 3, 4, 5],
  startHour: 9,
  endHour: 18,
};

export const getConfig = getAvailabilityConfig;
export const saveConfig = saveAvailabilityConfig;
export function listBookings(): Booking[] {
  return listBookingsSync();
}
export function cancelBooking(id: string) {
  void cancelBookingFn({ data: { id } });
}

let _configCache: AvailabilityConfig | null = null;
let _bookingsCache: Booking[] = [];

export function getAvailabilityConfig(): AvailabilityConfig {
  return _configCache ?? {
    timezone: "Africa/Abidjan",
    durationMin: 30,
    bufferMin: 10,
    workingDays: [1, 2, 3, 4, 5],
    startHour: 9,
    endHour: 18,
  };
}

export function saveAvailabilityConfig(c: AvailabilityConfig) {
  _configCache = c;
  void saveBookingConfig({ data: c });
}

export function listBookingsSync(): Booking[] {
  return _bookingsCache;
}

export async function hydrateBookingFromServer() {
  const cfg = await getBookingConfig();
  if (cfg) {
    _configCache = {
      timezone: cfg.timezone ?? "Africa/Abidjan",
      durationMin: cfg.durationMin ?? 30,
      bufferMin: cfg.bufferMin ?? 10,
      workingDays: (cfg.workingDays as number[]) ?? [1, 2, 3, 4, 5],
      startHour: cfg.startHour ?? 9,
      endHour: cfg.endHour ?? 18,
    };
  }
  const rows = await fetchBookings();
  _bookingsCache = rows.map((b) => ({
    id: b.id,
    name: b.name,
    email: b.email,
    company: b.company ?? undefined,
    topic: b.topic,
    message: b.message ?? undefined,
    startISO: b.startIso.toISOString(),
    endISO: b.endIso.toISOString(),
    status: b.status ?? "confirmed",
  }));
}

export function createBookingSync(b: Omit<Booking, "id" | "status">) {
  void createBooking({
    data: {
      name: b.name,
      email: b.email,
      company: b.company,
      topic: b.topic,
      message: b.message,
      startIso: b.startISO,
      endIso: b.endISO,
    },
  });
}
