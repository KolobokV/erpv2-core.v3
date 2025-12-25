type Props = {
  clientId: string;
  events: number;
  tasks: number;
};

export default function OnboardingResultPanel({ clientId, events, tasks }: Props) {
  return (
    <div style={{ padding: 16, border: "1px solid #e5e7eb", borderRadius: 8 }}>
      <h3>Client created</h3>
      <p>Client ID: {clientId}</p>
      <p>Control events generated: {events}</p>
      <p>Tasks generated: {tasks}</p>
    </div>
  );
}