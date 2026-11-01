// A shared revision is immutable until a server transaction succeeds.
export class SharedState {
  constructor() { this.revision = 0; this.dirty = false; this.generation = 0; this.latest = null; }
  edit() { this.dirty = true; this.generation++; }
  receive(record) {
    this.latest = record;
    if (this.dirty) return false;
    this.revision = record?.revision ?? 0;
    return true;
  }
  accept() { this.dirty = false; this.revision = this.latest?.revision ?? 0; return this.latest; }
  async save(payload, commit) {
    const generation = this.generation;
    const revision = await commit(this.revision, payload);
    this.revision = revision;
    if (generation === this.generation) this.dirty = false;
    return !this.dirty;
  }
}
