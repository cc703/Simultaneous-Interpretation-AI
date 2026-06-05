import { useStore } from './store/index.js';

export default function App() {
  const sourceMode = useStore((state) => state.sourceMode);
  const subtitleMode = useStore((state) => state.subtitleMode);

  return (
    <main>
      <div>Hello Interpreter</div>
      <p>Source: {sourceMode}</p>
      <p>Subtitle mode: {subtitleMode}</p>
    </main>
  );
}
