import { notFound } from 'next/navigation';
import { CallPanelPreview } from './preview';

// A page for checking the call transcript panel and its number keypad without
// making a call (every real call uses scarce free credit).
//
// It exists only on a developer's machine: in a production build it answers
// 404, so it never appears on the live site.
export default function Page() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <CallPanelPreview />;
}
