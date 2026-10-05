import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface SafeUser {
  id: string;
  email: string;
  name: string;
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<SafeUser> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return { id: user.id, email: user.email, name: user.name };
  }

  async updateName(id: string, name: string): Promise<SafeUser> {
    const user = await this.prisma.user.update({ where: { id }, data: { name } });
    return { id: user.id, email: user.email, name: user.name };
  }
}
