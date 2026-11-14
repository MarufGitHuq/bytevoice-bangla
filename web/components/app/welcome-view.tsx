import { VoiceOrb } from '@/components/app/voice-orb';
import { Button } from '@/components/ui/button';

const CAPABILITIES = ['Explains the platform', 'Checks the calendar live', 'Books a discovery call'];

interface WelcomeViewProps {
  startButtonText: string;
  onStartCall: () => void;
}

export const WelcomeView = ({
  startButtonText,
  onStartCall,
  ref,
}: React.ComponentProps<'div'> & WelcomeViewProps) => {
  return (
    <div ref={ref}>
      <section className="flex flex-col items-center justify-center px-6 text-center">
        <VoiceOrb className="size-[200px] md:size-[240px]" />

        <p className="mt-2 font-mono text-[11px] tracking-[0.2em] text-zinc-400 uppercase">
          Voice Receptionist
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-[-0.03em] text-white md:text-6xl">
          Meet <span className="text-brand-gradient">Mira</span>
        </h1>
        <p className="mt-4 max-w-md text-base leading-7 text-pretty text-zinc-400">
          She answers for Meta Co-Founder, the AI business operating system. Tell her which part of
          your business you want an AI employee to take on. She will explain how it works, check
          the calendar, and book a call with Maruf while you talk.
        </p>

        <ul className="mt-6 flex flex-wrap items-center justify-center gap-2">
          {CAPABILITIES.map((item) => (
            <li
              key={item}
              className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-zinc-300"
            >
              {item}
            </li>
          ))}
        </ul>

        <Button
          size="lg"
          onClick={onStartCall}
          className="mt-8 h-12 w-60 rounded-xl bg-[#2024bd] text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition-colors hover:bg-[#2024bd]/90"
        >
          {startButtonText}
        </Button>
        <p className="mt-3 text-xs text-zinc-500">Uses your microphone · Preview build</p>
      </section>

      <div className="fixed bottom-5 left-0 flex w-full items-center justify-center px-6">
        <p className="text-center font-mono text-[11px] leading-5 text-pretty text-zinc-600">
          Speech-to-text · LLM · text-to-speech on LiveKit Agents · tool calling · React Three
          Fiber + GLSL
        </p>
      </div>
    </div>
  );
};
