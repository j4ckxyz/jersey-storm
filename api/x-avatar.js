import { avatarResponse } from '../lib/handlers.js';
import { send } from './_send.js';

export default async (req, res) => send(res, await avatarResponse(new URLSearchParams(req.query || {})));
