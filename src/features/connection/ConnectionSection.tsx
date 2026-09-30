/** Settings → Connection section. Owned by w1-backend (stub). */
import { ConnectionForm } from './ConnectionForm';
import s from './Connection.module.css';

export function ConnectionSection() {
  return (
    <section className={s.section} aria-labelledby="connection-title">
      <h2 id="connection-title" className={s.title}>Connection</h2>
      <ConnectionForm />
    </section>
  );
}

export default ConnectionSection;
