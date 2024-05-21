import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'super-public-key';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
