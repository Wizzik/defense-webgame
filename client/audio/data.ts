import raw from "../../data/generated/audio.json";
import { type AudioData, AudioDataSchema } from "../../data/schema/audio";

/** The generated audio data (cues, tracks and what plays them). */
export function loadAudioData(): AudioData {
  return AudioDataSchema.parse(raw);
}
