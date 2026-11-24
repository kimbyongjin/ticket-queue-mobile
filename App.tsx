import { useRef, useState } from 'react';
import { Button, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Sentry from '@sentry/react-native';
import { hasDsn, QueueRequestCancelled } from './telemetry';

type Ticket = { id: string; title: string; description: string };

const tickets: Ticket[] = [
  { id: 'checkout', title: 'Mobile checkout freezes', description: 'The checkout spinner keeps turning after I tap Pay on my phone.' },
  { id: 'receipt', title: 'Receipt email delayed', description: 'My order went through, but the receipt arrived twenty minutes later.' },
  { id: 'cart', title: 'Cart quantity resets', description: 'I changed the quantity from one to three. When I reopened the cart, it showed one again.' },
  { id: 'tracking', title: 'Tracking link opens a blank page', description: 'I tapped Track shipment in my order history and got a blank page.' },
];

function isTicket(value: unknown): value is Ticket {
  return typeof value === 'object' && value !== null
    && 'id' in value && typeof value.id === 'string'
    && 'title' in value && typeof value.title === 'string'
    && 'description' in value && typeof value.description === 'string';
}

function decodeQueue(payload: unknown): Ticket[] {
  if (!Array.isArray(payload) || !payload.every(isTicket)) {
    throw new Error('Ticket queue response has an invalid format');
  }
  return payload;
}

function TicketRow({ ticket }: { ticket: Ticket }) {
  // Keep expansion local so opening one ticket preserves the other rows.
  const [expanded, setExpanded] = useState(false);
  return (
    <View style={styles.ticket}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={ticket.title}
        accessibilityState={{ expanded }}
        style={styles.ticketHeader}
        onPress={() => setExpanded(open => !open)}
      >
        <Text style={styles.ticketTitle}>{ticket.title}</Text>
        <Text>{expanded ? '−' : '+'}</Text>
      </Pressable>
      {expanded && <Text style={styles.description}>{ticket.description}</Text>}
    </View>
  );
}

function App() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('Ready to load tickets.');
  const [rows, setRows] = useState<Ticket[]>([]);
  const request = useRef<AbortController | null>(null);

  async function loadQueue(mode: 'normal' | 'slow' | 'invalid') {
    // Two quick taps can arrive before React disables the buttons.
    if (request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setRows([]);
    setMessage('Loading tickets…');
    try {
      // Time the whole user action. The child span shows how much time the read consumed.
      const result = await Sentry.startSpan({ name: 'Load ticket queue', op: 'ui.action', forceTransaction: true }, async () => {
        const payload = await Sentry.startSpan({ name: 'Read fixture', op: 'queue.read' }, async () => {
          if (mode === 'normal') return tickets;
          // Wrap the array to simulate a response that violates the decoder’s contract.
          if (mode === 'invalid') return { tickets };
          await new Promise<void>((resolve, reject) => {
            const timer = setTimeout(resolve, 4000);
            controller.signal.addEventListener('abort', () => {
              clearTimeout(timer);
              reject(new QueueRequestCancelled('User cancelled queue load'));
            }, { once: true });
          });
          return tickets;
        });
        return decodeQueue(payload);
      });
      setRows(result);
      setMessage('Tickets loaded.');
    } catch (error) {
      Sentry.captureException(error);
      setMessage(error instanceof QueueRequestCancelled ? 'Load cancelled.' : 'Could not read the ticket queue.');
    } finally {
      request.current = null;
      setBusy(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Text style={styles.title}>Ticket queue</Text>
      <Text style={styles.status}>{message}</Text>
      {rows.map(ticket => <TicketRow key={ticket.id} ticket={ticket} />)}
      <Button title="Load tickets" disabled={busy} onPress={() => loadQueue('normal')} />
      <Button title="Load slow queue" disabled={busy} onPress={() => loadQueue('slow')} />
      <Button title="Load invalid response" disabled={busy} onPress={() => loadQueue('invalid')} />
      {busy && <Button title="Cancel load" onPress={() => request.current?.abort()} />}
      {!hasDsn && <Text style={styles.note}>Local demo · Set the Sentry DSN to send events.</Text>}
    </ScrollView>
  );
}

export default Sentry.wrap(App);

const styles = StyleSheet.create({
  page: { flexGrow: 1, justifyContent: 'center', padding: 28, gap: 12, backgroundColor: '#f8fafc' },
  title: { fontSize: 32, fontWeight: '700', color: '#192739' },
  status: { fontSize: 16, color: '#37485d' },
  ticket: { backgroundColor: '#ffffff' },
  ticketHeader: { minHeight: 44, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  ticketTitle: { flex: 1, color: '#192739', fontWeight: '600' },
  description: { paddingHorizontal: 12, paddingBottom: 12, color: '#37485d' },
  note: { marginTop: 12, fontSize: 14, color: '#526176' },
});
