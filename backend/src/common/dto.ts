import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  ArrayNotEmpty,
} from 'class-validator';
import { UserType } from '../entities/user.entity';

export class CreateKeywordDto {
  @IsString()
  @IsNotEmpty()
  word!: string;
}

export class BulkKeywordsDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  words!: string[];

  @IsOptional()
  @IsBoolean()
  replace?: boolean;
}

export class CreateGroupDto {
  @IsString()
  @IsNotEmpty()
  identifier!: string;

  @IsOptional()
  @IsString()
  title?: string;
}

export class BulkGroupsDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  identifiers!: string[];

  @IsOptional()
  @IsBoolean()
  replace?: boolean;
}

export class UpdateSettingsDto {
  @IsOptional()
  @IsString()
  employerChannelId?: string;

  @IsOptional()
  @IsString()
  seekerChannelId?: string;

  @IsOptional()
  @IsString()
  employerMessageTemplate?: string;

  @IsOptional()
  @IsString()
  seekerMessageTemplate?: string;
}

export class BlockUserDto {
  @IsString()
  @IsNotEmpty()
  telegramUserId!: string;

  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  phone?: string;
}

export class UpdateUserTypeDto {
  @IsIn(['employer', 'seeker', 'scammer'])
  type!: UserType;
}
