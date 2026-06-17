// A self-contained incoming-call ringtone synthesized with the Web Audio API —
// no audio asset to ship and it works offline. Plays a classic dual-tone phone
// ring (440 Hz + 480 Hz) in a repeating "ring-ring … pause" cadence until
// stopped.
//
// Browsers block audio before a user gesture; start() resumes the audio context
// and fails silently if the recipient hasn't interacted with the page yet (the
// incoming-call banner still shows, just without sound). To swap in a real
// audio file later, replace the synthesis with an <audio loop> element.

type Ringtone = { start: () => void; stop: () => void };

export function createRingtone(): Ringtone {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let active = false;

  // One tone burst: the two ring frequencies together, with a short fade in/out
  // so the start and end don't click.
  function burst(at: number, dur: number) {
    if (!ctx || !master) return;
    const g = ctx.createGain();
    g.connect(master);
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(1, at + 0.02);
    g.gain.setValueAtTime(1, at + dur - 0.05);
    g.gain.linearRampToValueAtTime(0, at + dur);
    for (const freq of [440, 480]) {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq;
      osc.connect(g);
      osc.start(at);
      osc.stop(at + dur);
    }
  }

  // "ring-ring", then a pause, then schedule the next cycle.
  function cycle() {
    if (!active || !ctx) return;
    const now = ctx.currentTime;
    burst(now, 0.4);
    burst(now + 0.6, 0.4);
    timer = setTimeout(cycle, 3000);
  }

  return {
    async start() {
      if (active) return;
      try {
        const AC =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext;
        if (!AC) return;
        ctx ??= new AC();
        if (ctx.state === "suspended") await ctx.resume();
        master = ctx.createGain();
        master.gain.value = 0.22; // overall volume
        master.connect(ctx.destination);
        active = true;
        cycle();
      } catch {
        active = false;
      }
    },
    stop() {
      active = false;
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      // Ramp the master gain down so any in-flight burst is silenced instantly.
      if (ctx && master) {
        try {
          const t = ctx.currentTime;
          master.gain.cancelScheduledValues(t);
          master.gain.setValueAtTime(master.gain.value, t);
          master.gain.linearRampToValueAtTime(0, t + 0.05);
        } catch {
          /* context may be closed — ignore */
        }
        master = null;
      }
    },
  };
}
