import type {NextConfig} from 'next';
import {PHASE_DEVELOPMENT_SERVER} from 'next/constants';

export default function config(phase:string):NextConfig {
  return {
    // Keep dev output independent from production builds to prevent chunk races.
    distDir: phase===PHASE_DEVELOPMENT_SERVER?'.next-dev':'.next',
    images:{remotePatterns:[{protocol:'https',hostname:'images.unsplash.com'}]},
  };
}
