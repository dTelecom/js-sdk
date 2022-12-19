import { Trickle } from '../client';
export type { Trickle };

export interface Signal {
  onnegotiate?: (jsep: RTCSessionDescriptionInit) => void;
  ontrickle?: (trickle: Trickle) => void;

  join(sid: string, uid: string, name: string, offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit>;
  offer(offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit>;
  answer(answer: RTCSessionDescriptionInit): void;
  trickle(trickle: Trickle): void;
  close(): void;
}
