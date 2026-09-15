/**
 * Horizon Star Wars App — the federated entry point loaded by the Horizon host.
 *
 * Registers one full-page route: "Star Wars", mounted under the host's /apps
 * outlet so it sits in the Apps menu alongside Example CRM and the Pokemon
 * app. Same shape as horizon-pokemon-app, a different public data source, and
 * the same single write: adopting an image as the user's avatar.
 */
import type { HorizonContext } from '@netsapiens/horizon-sdk';
import { useEffect, useMemo, useRef } from 'react';
import { HorizonContextProvider, useRemoteApp } from '@netsapiens/horizon-sdk';

import CharactersPage from './pages/CharactersPage';

// Injected at build time by webpack DefinePlugin (see webpack.config.js) —
// the same value as the ModuleFederationPlugin `name`, which the registered
// app row's `webpack_module` must match exactly. Never hardcode it twice.
declare const __MF_NAME__: string;

export default function App(horizonContext: HorizonContext) {
  const { sdk } = useRemoteApp(horizonContext, __MF_NAME__);

  // The host rebuilds `horizonContext` on every colour-mode change, `ui`
  // included. The wrapper below is memoized with empty deps to keep a STABLE
  // component identity (re-creating it would unmount the page on every
  // render), so it must read the LATEST context through this ref rather than
  // closing over the one captured at first paint — otherwise `theme` keeps
  // updating while `ui.theme`/`ui.styles` stay on the load-time mode.
  const contextRef = useRef(horizonContext);
  contextRef.current = horizonContext;

  const CharactersPageWithContext = useMemo(
    () =>
      function CharactersPageWithContext() {
        return (
          <HorizonContextProvider context={contextRef.current}>
            <CharactersPage />
          </HorizonContextProvider>
        );
      },
    [],
  );

  useEffect(() => {
    // registerRoute is async; surface failures rather than dropping them.
    sdk
      .registerRoute({
        id: 'starwars-characters',
        // Mounts under the host's /apps outlet (-> /apps/starwars), the same
        // menu Example CRM registers into.
        parentPath: '/apps',
        path: 'starwars',
        label: 'Star Wars',
        icon: 'mdi:death-star-variant',
        placement: { last: true },
        // No `requiredScopes` on purpose, matching Example CRM: this is a
        // public-data demo page and /apps carries no section floor, so any
        // signed-in user can open it. The one write it makes acts on the
        // caller's OWN avatar, so there is nothing here to gate by tier. Any
        // page that reads real customer data MUST declare one instead.
        component: CharactersPageWithContext,
      })
      .catch((error) =>
        console.error(
          '[Star Wars App] Failed to register the characters page:',
          error,
        ),
      );
  }, [sdk]);

  // Headless remote — all UI is injected into the host.
  return null;
}
