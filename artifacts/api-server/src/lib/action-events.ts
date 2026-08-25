export type PoppolActionEvent = {
  id: string;
  politicianId: string;
  itemId: string;
  quantity: number;
  createdAt: string;
};

type Subscriber = (event: PoppolActionEvent) => void;

const subscribers = new Set<Subscriber>();

export function subscribeToPoppolActions(subscriber: Subscriber): () => void {
  subscribers.add(subscriber);
  return () => subscribers.delete(subscriber);
}

export function publishPoppolAction(event: PoppolActionEvent): void {
  for (const subscriber of subscribers) subscriber(event);
}