import { IsEmail, IsString, MinLength } from 'class-validator';

export class CreateInviteDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(1)
  name: string;
}
