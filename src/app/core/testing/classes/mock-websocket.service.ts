import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { when } from 'jest-when';
import { of } from 'rxjs';
import { ApiDirectory, ApiMethod } from 'app/interfaces/api-directory.interface';
import { Job } from 'app/interfaces/job.interface';
import { WebSocketService } from 'app/services';

/**
 * MockWebsocketService can be used to update websocket mocks on the fly.
 * For initial setup prefer mockWebsocket();
 *
 * To update on the fly:
 * @example
 * ```
 * // In test case:
 * const websocketService = spectator.inject(MockWebsocketService);
 * websocketService.mockCallOnce('filesystem.stat', { gid: 5 } as FileSystemStat);
 * ```
 */
@Injectable()
export class MockWebsocketService extends WebSocketService {
  private jobIdCounter = 1;

  constructor(
    private router: Router,
  ) {
    super(router);

    this.call = jest.fn();
    this.job = jest.fn();
    this.subscribe = jest.fn(() => of());
    when(this.call).mockImplementation((method: ApiMethod, args: unknown[]) => {
      throw Error(`Unmocked websocket call ${method} with ${JSON.stringify(args)}`);
    });
    when(this.job).mockImplementation((method: ApiMethod, args: unknown[]) => {
      throw Error(`Unmocked websocket job call ${method} with ${JSON.stringify(args)}`);
    });
  }

  mockCall<K extends ApiMethod>(method: K, response: ApiDirectory[K]['response']): void {
    when(this.call).calledWith(method).mockReturnValue(of(response));
    when(this.call).calledWith(method, expect.anything()).mockReturnValue(of(response));
  }

  mockCallOnce<K extends ApiMethod>(method: K, response: ApiDirectory[K]['response']): void {
    when(this.call).calledWith(method, expect.anything()).mockReturnValueOnce(of(response));
  }

  mockJob<K extends ApiMethod>(method: K, response: Job<ApiDirectory[K]['response']>): void {
    const responseWithJobId = {
      ...response,
      id: this.jobIdCounter,
    };
    when(this.call).calledWith(method, expect.anything()).mockReturnValue(of(this.jobIdCounter));
    when(this.job).calledWith(method, expect.anything()).mockReturnValue(of(responseWithJobId));
    when(this.call)
      .calledWith('core.get_jobs', [[['id', '=', this.jobIdCounter]]])
      .mockReturnValue(of([responseWithJobId]));

    this.jobIdCounter += 1;
  }

  onclose(): void {
    // Noop to avoid calling redirect.
  }
}
