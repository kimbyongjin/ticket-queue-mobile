import { useRef, useState } from 'react';
import { Button, StyleSheet, Text, View } from 'react-native';
import * as Sentry from '@sentry/react-native';
import { hasDsn, QueueRequestCancelled } from './telemetry';

const tickets = ['Mobile checkout freezes', 'Receipt email delayed'];

function decodeQueue(payload: unknown): string[] {
  if (!Array.isArray(payload) || !payload.every(item => typeof item === 'string')) {
    throw new Error('Ticket queue response has an invalid format');
  }
  return payload;
}

function App() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('Ready to load tickets.');
  const [rows, setRows] = useState<string[]>([]);
  const request = useRef<AbortController | null>(null);

  async function loadQueue(invalid: boolean) {
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
          // Wrap the array to simulate a response that violates the decoder’s contract.
          if (invalid) return { tickets };
          await new Promise<void>((resolve, reject) => {
            const timer = setTimeout(resolve, 1500);
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
    <View style={styles.page}>
      <Text style={styles.title}>Ticket queue</Text>
      <Text style={styles.status}>{message}</Text>
      {rows.map(ticket => <Text key={ticket} style={styles.ticket}>{ticket}</Text>)}
      <Button title="Load slow queue" disabled={busy} onPress={() => loadQueue(false)} />
      <Button title="Load invalid response" disabled={busy} onPress={() => loadQueue(true)} />
      {busy && <Button title="Cancel load" onPress={() => request.current?.abort()} />}
      {!hasDsn && <Text style={styles.note}>Local demo · Set the Sentry DSN to send events.</Text>}
    </View>
  );
}

export default Sentry.wrap(App);

const styles = StyleSheet.create({
  page: { flex: 1, justifyContent: 'center', padding: 28, gap: 12, backgroundColor: '#f8fafc' },
  title: { fontSize: 32, fontWeight: '700', color: '#192739' },
  status: { fontSize: 16, color: '#37485d' },
  ticket: { padding: 12, backgroundColor: '#ffffff', color: '#192739' },
  note: { marginTop: 12, fontSize: 14, color: '#526176' },
});
