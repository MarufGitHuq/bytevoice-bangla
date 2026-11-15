// Every piece of text on the landing page, in English and Bangladeshi Bangla.
// The Bangla is written the way people in Dhaka say it, not West Bengal wording.
// Keeping both languages side by side makes a missing translation easy to spot:
// TypeScript fails the build if `bn` lacks a key that `en` has.

export type Lang = 'en' | 'bn';

const en = {
  meta: {
    toggle: 'বাংলা',
    toggleLabel: 'Switch to Bangla',
  },
  nav: {
    callers: 'What callers can do',
    staff: 'For staff',
    portal: 'Staff portal',
  },
  hero: {
    eyebrow: 'ByteVoice for Bangla · live demo',
    title: 'A receptionist who answers in Bangla, day and night',
    subtitle:
      'Call Mitu, the AI receptionist at Dhaka Dental Care. Book, move or cancel a visit just by talking, the way you would on the phone.',
    cta: 'Talk to our Bangla caller',
    idleHint: 'Uses your microphone. The call is saved to the demo staff portal.',
  },
  call: {
    connecting: 'Connecting to Mitu…',
    listening: 'Mitu is listening',
    thinking: 'Mitu is thinking',
    speaking: 'Mitu is speaking',
    end: 'End call',
    endedTitle: 'Call ended',
    endedBody: 'Thanks for calling. The transcript and any booking are now in the staff portal.',
    again: 'Call again',
    openPortal: 'Open the staff portal',
    transcript: 'Live transcript',
    transcriptEmpty: 'What you and Mitu say appears here.',
    you: 'You',
    agent: 'Mitu',
    typeLabel: 'Type a message to Mitu',
    typePlaceholder: 'Or type here…',
    send: 'Send',
    progress: 'Done so far',
    steps: {
      availability_checked: 'Free times checked',
      phone_verified: 'Phone number verified',
      booked: 'Appointment booked',
      rescheduled: 'Appointment moved',
      cancelled: 'Appointment cancelled',
      callback: 'Callback requested',
    },
    reference: 'Booking reference',
    download: 'Download call record',
    record: {
      title: 'Dhaka Dental Care: call record',
      date: 'Date',
      length: 'Call length',
      outcome: 'What was done',
      nothing: 'No booking was made or changed on this call.',
      patient: 'Name',
      transcript: 'Transcript',
      note: 'Demo clinic with test data. Keep the booking reference in case you need to change the appointment.',
    },
    retry: 'Try again',
    errors: {
      micDenied:
        'Microphone access is blocked. Allow it from the icon in the address bar, then try again.',
      noMic: 'No microphone was found. Connect one, or open this page on your phone.',
      connection: 'The call could not connect. Check your internet and try again.',
      busy: 'Too many calls from this network. Please wait a few minutes.',
      agent: 'Mitu did not pick up. Please try again in a minute.',
    },
  },
  callers: {
    title: 'What callers can do',
    lead: 'Mitu speaks everyday Bangladeshi Bangla. She says dates and times in words, the way a person would.',
    items: [
      {
        title: 'Book a visit',
        body: 'Say what the problem is and which day suits you. Mitu offers free times and repeats the booking back.',
      },
      {
        title: 'Move a visit',
        body: 'Give your phone number and a new day. The old time is freed for someone else.',
      },
      {
        title: 'Cancel',
        body: 'Mitu finds your booking, checks it is the right one, then cancels it.',
      },
      {
        title: 'Ask about the clinic',
        body: 'Opening hours, doctors, address and listed fees. If she does not know, she says so.',
      },
    ],
  },
  staff: {
    title: 'Every call lands in the staff portal',
    lead: 'Front-desk staff see what happened on each call without listening to it.',
    items: [
      'Call list with date, caller, length and outcome, plus search and filters.',
      'The full transcript, showing who said what and when.',
      'Each booking and its history: booked, moved, cancelled.',
      'A short summary of every call in Bangla and English.',
    ],
    cta: 'Open the staff portal',
    note: 'The reviewer login is in the submission email.',
    sampleCaller: 'Caller',
    sampleAgent: 'Mitu',
    sampleOutcome: 'Booked',
  },
  footer: {
    line: 'ByteVoice for Bangla: a take-home demo built for StrategyByte.',
    fiction: 'Dhaka Dental Care is a fictional clinic. Do not share real health details on a call.',
  },
};

export type Copy = typeof en;

const bn: Copy = {
  meta: {
    toggle: 'English',
    toggleLabel: 'ইংরেজিতে দেখুন',
  },
  nav: {
    callers: 'কলাররা যা করতে পারেন',
    staff: 'স্টাফদের জন্য',
    portal: 'স্টাফ পোর্টাল',
  },
  hero: {
    eyebrow: 'বাংলার জন্য ByteVoice · লাইভ ডেমো',
    title: 'দিনরাত বাংলায় কথা বলে এমন রিসেপশনিস্ট',
    subtitle:
      'ঢাকা ডেন্টাল কেয়ারের এআই রিসেপশনিস্ট মিতুকে কল দিন। ফোনে যেভাবে কথা বলেন, সেভাবেই অ্যাপয়েন্টমেন্ট বুক, সময় বদল বা বাতিল করুন।',
    cta: 'আমাদের বাংলা রিসেপশনিস্টের সাথে কথা বলুন',
    idleHint: 'মাইক্রোফোন লাগবে। কলটি ডেমো স্টাফ পোর্টালে সেভ হবে।',
  },
  call: {
    connecting: 'মিতুর সাথে কানেক্ট হচ্ছে…',
    listening: 'মিতু শুনছে',
    thinking: 'মিতু ভাবছে',
    speaking: 'মিতু কথা বলছে',
    end: 'কল কেটে দিন',
    endedTitle: 'কল শেষ হয়েছে',
    endedBody: 'কল করার জন্য ধন্যবাদ। কলের ট্রান্সক্রিপ্ট আর বুকিং এখন স্টাফ পোর্টালে আছে।',
    again: 'আবার কল করুন',
    openPortal: 'স্টাফ পোর্টাল দেখুন',
    transcript: 'লাইভ ট্রান্সক্রিপ্ট',
    transcriptEmpty: 'আপনি আর মিতু যা বলবেন, এখানে লেখা দেখা যাবে।',
    you: 'আপনি',
    agent: 'মিতু',
    typeLabel: 'মিতুকে লিখে জানান',
    typePlaceholder: 'চাইলে লিখেও বলতে পারেন…',
    send: 'পাঠান',
    progress: 'এ পর্যন্ত যা হয়েছে',
    steps: {
      availability_checked: 'খালি সময় দেখা হয়েছে',
      phone_verified: 'ফোন নম্বর যাচাই হয়েছে',
      booked: 'অ্যাপয়েন্টমেন্ট বুক হয়েছে',
      rescheduled: 'অ্যাপয়েন্টমেন্টের সময় বদলেছে',
      cancelled: 'অ্যাপয়েন্টমেন্ট বাতিল হয়েছে',
      callback: 'কলব্যাকের অনুরোধ নেওয়া হয়েছে',
    },
    reference: 'বুকিং রেফারেন্স',
    download: 'কলের বিবরণ ডাউনলোড করুন',
    record: {
      title: 'ঢাকা ডেন্টাল কেয়ার: কলের বিবরণ',
      date: 'তারিখ',
      length: 'কলের সময়',
      outcome: 'যা করা হয়েছে',
      nothing: 'এই কলে কোনো বুকিং করা বা বদলানো হয়নি।',
      patient: 'নাম',
      transcript: 'ট্রান্সক্রিপ্ট',
      note: 'এটি টেস্ট ডেটাসহ একটি ডেমো ক্লিনিক। অ্যাপয়েন্টমেন্ট বদলাতে চাইলে বুকিং রেফারেন্সটি রেখে দিন।',
    },
    retry: 'আবার চেষ্টা করুন',
    errors: {
      micDenied:
        'মাইক্রোফোনের অনুমতি বন্ধ আছে। অ্যাড্রেস বারের আইকন থেকে অনুমতি দিয়ে আবার চেষ্টা করুন।',
      noMic: 'কোনো মাইক্রোফোন পাওয়া যায়নি। মাইক্রোফোন লাগান, অথবা ফোন থেকে এই পেজটি খুলুন।',
      connection: 'কলটি কানেক্ট হয়নি। ইন্টারনেট চেক করে আবার চেষ্টা করুন।',
      busy: 'এই নেটওয়ার্ক থেকে অনেকগুলো কল হয়েছে। কয়েক মিনিট পরে চেষ্টা করুন।',
      agent: 'মিতু কল ধরেনি। এক মিনিট পরে আবার চেষ্টা করুন।',
    },
  },
  callers: {
    title: 'কলাররা যা করতে পারেন',
    lead: 'মিতু প্রতিদিনের বাংলাদেশি বাংলায় কথা বলে। তারিখ আর সময় সংখ্যা পড়ে না, মানুষের মতো কথায় বলে।',
    items: [
      {
        title: 'অ্যাপয়েন্টমেন্ট বুক',
        body: 'কী সমস্যা আর কোন দিন সুবিধা, সেটা বলুন। মিতু খালি সময় জানাবে আর বুকিংটা আবার মিলিয়ে নেবে।',
      },
      {
        title: 'সময় বদল',
        body: 'ফোন নম্বর আর নতুন দিন বলুন। আগের সময়টা অন্য কারও জন্য খালি হয়ে যাবে।',
      },
      {
        title: 'বাতিল',
        body: 'মিতু আপনার বুকিং খুঁজে বের করবে, ঠিক বুকিং কি না মিলিয়ে নেবে, তারপর বাতিল করবে।',
      },
      {
        title: 'ক্লিনিকের তথ্য',
        body: 'খোলার সময়, ডাক্তার, ঠিকানা আর ফি। কোনো তথ্য জানা না থাকলে মিতু সোজাসুজি সেটা বলবে।',
      },
    ],
  },
  staff: {
    title: 'প্রতিটি কল স্টাফ পোর্টালে জমা হয়',
    lead: 'রিসেপশনের স্টাফরা কল না শুনেই দেখতে পারেন প্রতিটি কলে কী হয়েছে।',
    items: [
      'তারিখ, কলার, কলের সময় আর ফলাফলসহ কলের তালিকা; খোঁজা আর ফিল্টার করা যায়।',
      'পুরো ট্রান্সক্রিপ্ট, কে কখন কী বলেছে সহ।',
      'প্রতিটি বুকিং আর তার ইতিহাস: বুক, সময় বদল, বাতিল।',
      'প্রতিটি কলের ছোট সারাংশ, বাংলা আর ইংরেজিতে।',
    ],
    cta: 'স্টাফ পোর্টাল দেখুন',
    note: 'রিভিউয়ার লগইন সাবমিশন ইমেইলে দেওয়া আছে।',
    sampleCaller: 'কলার',
    sampleAgent: 'মিতু',
    sampleOutcome: 'বুক হয়েছে',
  },
  footer: {
    line: 'বাংলার জন্য ByteVoice: StrategyByte-এর জন্য বানানো একটি টেক-হোম ডেমো।',
    fiction: 'ঢাকা ডেন্টাল কেয়ার একটি কাল্পনিক ক্লিনিক। কলে আসল স্বাস্থ্যতথ্য দেবেন না।',
  },
};

export const COPY: Record<Lang, Copy> = { en, bn };

// The sample exchange shown on the portal preview card. It is Bangla in both
// modes because the calls themselves are always in Bangla.
export const SAMPLE_EXCHANGE = [
  { who: 'caller', text: 'আমার দাঁতে খুব ব্যথা, কালকে কি দেখানো যাবে?' },
  { who: 'agent', text: 'জি, কালকে সকাল এগারোটায় সময় খালি আছে। বুক করে দেব?' },
  { who: 'caller', text: 'হ্যাঁ, দিয়ে দেন।' },
] as const;
