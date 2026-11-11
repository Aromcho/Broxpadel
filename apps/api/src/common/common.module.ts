import { Global, Module } from '@nestjs/common';
import { RevalidateService } from './revalidate.service';
import { ActivityService } from './activity.service';

@Global()
@Module({ providers: [RevalidateService, ActivityService], exports: [RevalidateService, ActivityService] })
export class CommonModule {}
