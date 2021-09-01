import { Theme } from '@types';
import { fromThrowable } from 'neverthrow';
import { IncomingMessage } from 'node:http';
import React from 'react';
import { reducer } from './reducer';
import { Action, IAppState } from './types';
const APP_STORAGE_KEY = 'nectar-app-state';

export const initialAppState: IAppState = {
  user: {
    username: 'anonymous',
    anonymous: true,
    access_token: '',
    expire_in: '',
  },
  theme: Theme.GENERAL,
};

// wrap the main reducer so we can debug/push changes to local storage
const nectarAppReducer: React.Reducer<IAppState, Action> = (state, action) => {
  console.groupCollapsed(`%cStore`, 'padding: 5px; color: white; background: dodgerblue', action.type);
  console.log('old', state);
  const newState: IAppState = reducer(state, action);
  console.log('new', newState);
  console.groupEnd();

  // flush the new state to localStorage
  requestAnimationFrame(() => {
    // skip storing user data, we'll grab that from the server session
    const { user, ...state } = newState;
    localStorage.setItem(APP_STORAGE_KEY, JSON.stringify(state));
  });

  return newState;
};

type AppStoreApi = {
  state: IAppState;
  dispatch: React.Dispatch<Action>;
};

const ctx = React.createContext<AppStoreApi>({
  state: null,
  dispatch: () => ({}),
});

const safeParse = <T>(value: string, defaultValue: T): T => {
  const result = fromThrowable<() => T, Error>(() => JSON.parse(value) as T);
  return result().unwrapOr(defaultValue);
};

const isServer = typeof window === 'undefined';
const fetchSessionDataFromDOM = (defaultValue: IAppState['user']): IAppState['user'] => {
  const sessionEl = isServer ? null : document.getElementById('__session__');

  // parse out the session data from the DOM
  const result = fromThrowable<() => IncomingMessage['session'], Error>(() => {
    const text = sessionEl.textContent;
    return JSON.parse(text) as IncomingMessage['session'];
  });
  return result().match(
    ({ userData }) => userData,
    () => defaultValue,
  );
};

const AppProvider = (props: React.PropsWithChildren<Record<string, unknown>>): React.ReactElement => {
  const [state, dispatch] = React.useReducer(
    nectarAppReducer,
    initialAppState,
    (initial): IAppState => {
      const newState = isServer
        ? initial
        : {
            ...initial,
            ...safeParse(localStorage.getItem(APP_STORAGE_KEY), initial),
            user: fetchSessionDataFromDOM(initial.user),
          };

      return newState;
    },
  );
  return React.createElement(ctx.Provider, { value: { state, dispatch }, ...props });
};

const useAppCtx = (): AppStoreApi => {
  const context = React.useContext(ctx);
  if (typeof context === 'undefined') {
    throw new Error('no provider for AppContext');
  }
  return context;
};

export { AppProvider, useAppCtx };
