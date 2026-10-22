import { travelResponse } from '../lib/handlers.js';
import { send } from './_send.js';

export default async (req, res) => send(res, await travelResponse());
