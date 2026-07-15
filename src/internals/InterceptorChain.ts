interface Entry<F, R> {
  resolved?: F;
  rejected?: R;
}

/**
 * 인터셉터 등록/순회를 담당하는 내부 구현입니다.
 * 등록 순서를 유지하며, `eject()`된 자리는 건너뜁니다(id 재사용 방지).
 */
export class InterceptorChain<F, R> {
  private entries: (Entry<F, R> | null)[] = [];

  use(resolved?: F, rejected?: R): number {
    this.entries.push({ resolved, rejected });
    return this.entries.length - 1;
  }

  eject(id: number): void {
    if (this.entries[id]) {
      this.entries[id] = null;
    }
  }

  /** 등록된(=`eject()`되지 않은) 인터셉터가 하나도 없으면 `true`입니다. */
  get isEmpty(): boolean {
    return this.entries.every((entry) => entry === null);
  }

  /** 등록된 인터셉터를 등록 순서대로 순회합니다(내부 전용). */
  forEach(fn: (entry: Entry<F, R>) => void): void {
    this.entries.forEach((entry) => {
      if (entry) fn(entry);
    });
  }
}
