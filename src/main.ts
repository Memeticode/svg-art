import { createApp } from './app';

const seed = new URLSearchParams(location.search).get('seed') ?? `f-${Date.now()}`;
createApp(seed);
