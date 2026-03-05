import { describe, it, expect, vi } from 'vitest';
import { CancelToken } from '../src/CancelToken';
import { CanceledError } from '../src/CanceledError';

describe('CancelToken', () => {
  it('초기 상태는 취소되지 않음이다', () => {
    const token = new CancelToken();
    expect(token.isCancelled).toBe(false);
  });

  it('signal은 AbortSignal을 반환한다', () => {
    const token = new CancelToken();
    expect(token.signal).toBeInstanceOf(AbortSignal);
    expect(token.signal.aborted).toBe(false);
  });

  it('cancel() 호출 시 isCancelled가 true가 된다', () => {
    const token = new CancelToken();
    token.cancel();
    expect(token.isCancelled).toBe(true);
  });

  it('cancel() 호출 시 signal이 abort된다', () => {
    const token = new CancelToken();
    token.cancel();
    expect(token.signal.aborted).toBe(true);
  });

  it('등록된 콜백이 cancel 시 실행된다', () => {
    const token = new CancelToken();
    const callback = vi.fn();
    token.register(callback);
    token.cancel('test reason');
    expect(callback).toHaveBeenCalledWith('test reason');
  });

  it('여러 콜백이 순서대로 실행된다', () => {
    const token = new CancelToken();
    const order: number[] = [];
    token.register(() => order.push(1));
    token.register(() => order.push(2));
    token.register(() => order.push(3));
    token.cancel();
    expect(order).toEqual([1, 2, 3]);
  });

  it('두 번 cancel해도 콜백은 한 번만 실행된다', () => {
    const token = new CancelToken();
    const callback = vi.fn();
    token.register(callback);
    token.cancel();
    token.cancel();
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('콜백에서 에러가 발생해도 다른 콜백은 실행된다', () => {
    const token = new CancelToken();
    const callback1 = vi.fn(() => { throw new Error('fail'); });
    const callback2 = vi.fn();
    token.register(callback1);
    token.register(callback2);

    vi.spyOn(console, 'error').mockImplementation(() => {});
    token.cancel();

    expect(callback1).toHaveBeenCalled();
    expect(callback2).toHaveBeenCalled();
  });

  it('throwIfCancelled()는 취소되지 않은 상태에서 아무것도 하지 않는다', () => {
    const token = new CancelToken();
    expect(() => token.throwIfCancelled()).not.toThrow();
  });

  it('throwIfCancelled()는 취소된 상태에서 CanceledError를 던진다', () => {
    const token = new CancelToken();
    token.cancel();
    expect(() => token.throwIfCancelled()).toThrow(CanceledError);
  });
});
