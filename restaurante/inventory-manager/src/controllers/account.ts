import type { AdminApiClient } from '@restaurante/contracts';
import { assertSameOrigin, readFormBody, type Logger, type SafeHtml } from '@restaurante/web';

import type { InventoryConfig } from '../config.ts';
import { clearSessionId, writeSessionId } from '../session.ts';
import type { Views } from '../views/index.ts';
import { ACCOUNT_PATH } from '../views/users.ts';
import { createControllerKit, type Ctx, type Session } from './common.ts';

/**
 * "Mi cuenta" del admin nuevo (REQ-F-040, RF-2 y RF-10): cualquier usuario con sesión cambia su propia
 * contraseña escribiendo la actual y dos veces la nueva. Solo actúa sobre el usuario de la sesión: el
 * formulario tiene una lista cerrada de campos (un `role`, `businesses` o un id dan 400).
 *
 * Al confirmarse, la API cierra todas las sesiones del usuario (también las del /admin actual) y
 * devuelve una sesión nueva para este navegador: su id reemplaza la cookie (mismo nombre y atributos) y
 * se vuelve a la página con POST/redirect/GET. Una contraseña actual incorrecta no cuenta para el
 * límite de intentos de acceso ("Paridad, sin límite (Recomendado)").
 */

type Handler = (ctx: Ctx) => Promise<void>;

export interface AccountController {
  page: Handler;
  changePassword: Handler;
}

const ACCOUNT_BODY_LIMIT = 16 * 1024;
const ACCOUNT_FIELDS = Object.freeze(['_csrf', 'currentPassword', 'password', 'passwordConfirmation']);
const CHANGED = 'Contraseña cambiada. Tus otras sesiones se cerraron; esta sigue abierta.';
const UNAVAILABLE = { tone: 'error' as const, title: 'Servicio no disponible.', paragraphs: ['No se pudo conectar con el sistema: no se cambió la contraseña. Inténtalo de nuevo en unos minutos.'] };

export function createAccountController({ config, api, views, logger }: { config: InventoryConfig; api: AdminApiClient; views: Views; logger: Logger }): AccountController {
  const kit = createControllerKit({ config, api, views, logger });
  const { send, seeOther, toLogin, failureReason, isUnavailable } = kit;

  const render = (ctx: Ctx, status: number, auth: Session | null, csrfToken: string, extra: { errors?: Record<string, string>; notices?: SafeHtml[] } = {}) =>
    send(ctx, status, views.account({ context: auth, csrfToken, ...extra }));

  return Object.freeze<AccountController>({
    async page(ctx) {
      const auth = await kit.session(ctx, ACCOUNT_PATH);
      if (!auth) return;
      const notices = ctx.query.ok === 'password_change' ? [views.notice({ tone: 'success', title: CHANGED })] : [];
      render(ctx, 200, auth, auth.csrfToken, { notices });
    },

    async changePassword(ctx) {
      assertSameOrigin(ctx, logger);
      const fields = await readFormBody(ctx, { limit: ACCOUNT_BODY_LIMIT });
      if ([...fields.keys()].some((name) => !ACCOUNT_FIELDS.includes(name))) ctx.throw(400, 'El formulario tiene campos desconocidos.', { code: 'INVALID_FORM' });
      const csrf = fields.get('_csrf') ?? '';
      const auth = await kit.session(ctx, ACCOUNT_PATH, () => {
        render(ctx, 503, null, csrf, { notices: [views.notice(UNAVAILABLE)] });
        return true;
      });
      if (!auth) return;
      const result = await api.changeOwnPassword(kit.credentials(auth, fields), {
        currentPassword: fields.get('currentPassword') ?? '',
        password: fields.get('password') ?? '',
        passwordConfirmation: fields.get('passwordConfirmation') ?? '',
      });
      if (result.ok) {
        // La sesión anterior ya no vale: la cookie pasa a la nueva (sin fijación de sesión).
        writeSessionId(ctx, config.isProduction, result.data.session.id);
        return seeOther(ctx, `${ACCOUNT_PATH}?ok=password_change`);
      }
      if (!result.ok && result.kind === 'http') {
        if (result.status === 422) return render(ctx, 422, auth, auth.csrfToken, { errors: result.error.fields ?? { '': result.error.message } });
        if (result.status === 401) {
          clearSessionId(ctx, config.isProduction);
          return toLogin(ctx, ACCOUNT_PATH);
        }
        if (result.status === 403) {
          return send(ctx, 403, views.message({ title: 'Petición no válida', notice: { tone: 'error', title: result.error.message }, context: auth, section: 'account', backHref: ACCOUNT_PATH, backLabel: 'Volver a Mi cuenta' }));
        }
      }
      if (isUnavailable(result)) logger.warn('api_unavailable', { path: ctx.path, reason: failureReason(result) });
      return render(ctx, 503, auth, auth.csrfToken, { notices: [views.notice(UNAVAILABLE)] });
    },
  });
}
