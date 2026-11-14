// The clinic the receptionist works for. Fictional: this is a demo with test
// data only. Everything the agent may state as fact about the clinic lives
// here, so nothing about the clinic is left for the language model to invent.

export const CLINIC = {
  nameBn: 'ঢাকা ডেন্টাল কেয়ার',
  nameEn: 'Dhaka Dental Care',
  agentNameBn: 'মিতু',
  timeZone: 'Asia/Dhaka',
  // +06:00 all year: Bangladesh has no daylight saving time.
  utcOffset: '+06:00',
  addressBn: 'বাড়ি বারো, রোড পাঁচ, ধানমন্ডি, ঢাকা। ধানমন্ডি পাঁচ নম্বর রোডের মাথায়, স্টার কাবাবের উল্টো দিকে।',
  phoneBn: 'শূন্য এক সাত শূন্য শূন্য, এক দুই তিন, চার পাঁচ ছয়',
  // Friday is the weekly holiday in Bangladesh.
  closedWeekday: 5,
  openHour: 10,
  closeHour: 20,
  hoursBn: 'শনিবার থেকে বৃহস্পতিবার, সকাল দশটা থেকে রাত আটটা। শুক্রবার বন্ধ।',
} as const;

export const DOCTORS = [
  { id: 'farhana', nameBn: 'ডাক্তার ফারহানা আহমেদ', nameEn: 'Dr. Farhana Ahmed', focusBn: 'সাধারণ দাঁতের চিকিৎসা, ফিলিং, রুট ক্যানাল' },
  { id: 'tanvir', nameBn: 'ডাক্তার তানভীর হাসান', nameEn: 'Dr. Tanvir Hasan', focusBn: 'ব্রেস, দাঁত সোজা করা, দাঁত তোলা' },
] as const;

export type DoctorId = (typeof DOCTORS)[number]['id'];
export const DOCTOR_IDS = DOCTORS.map((d) => d.id) as [DoctorId, ...DoctorId[]];

// Fees the receptionist is allowed to quote. Anything not listed here she must
// not price: she offers a callback instead.
export const SERVICES = [
  { nameBn: 'চেকআপ বা পরামর্শ', nameEn: 'Check-up / consultation', feeBn: 'পাঁচশো টাকা' },
  { nameBn: 'স্কেলিং ও পলিশিং', nameEn: 'Scaling and polishing', feeBn: 'দুই হাজার টাকা' },
  { nameBn: 'ফিলিং', nameEn: 'Filling', feeBn: 'দেড় হাজার টাকা থেকে শুরু' },
  { nameBn: 'রুট ক্যানাল', nameEn: 'Root canal', feeBn: 'আট হাজার টাকা থেকে শুরু' },
  { nameBn: 'দাঁত তোলা', nameEn: 'Extraction', feeBn: 'এক হাজার টাকা থেকে শুরু' },
] as const;

// Appointments start on the hour.
export const SLOT_HOURS = [10, 11, 12, 13, 15, 16, 17, 18, 19];

export function doctorById(id: string) {
  return DOCTORS.find((d) => d.id === id);
}
