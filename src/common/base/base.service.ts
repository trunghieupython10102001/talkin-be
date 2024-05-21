import { HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/share/prisma/prisma.service';

export class BaseService {
  protected prismaService: PrismaService;
  protected entityModel: string;
  protected fields: Map<string, Prisma.DMMF.Field>;
  protected configService: ConfigService;
  constructor(
    prismaService: PrismaService,
    entityModel: string,
    modelName: string,
    configService: ConfigService,
  ) {
    this.prismaService = prismaService;
    this.entityModel = entityModel;
    this.configService = configService;
    const tempFields =
      Prisma.dmmf.datamodel.models.find((model) => model.name == modelName)
        .fields || [];
    this.fields = new Map<string, Prisma.DMMF.Field>();
    for (const field of tempFields) {
      this.fields[field.name] = field;
    }
  }

  async getAll(req: Request, other: any = {}): Promise<any> {
    const params = this.exportParams(req);
    console.log('data: ', JSON.stringify(params));
    const { query, select, skip, take, sorts } = params;
    const allFields = this.getAllFields();

    const data = await this.prismaService[this.entityModel].findMany({
      where: query,
      select: Object.keys(select).length !== 0 ? select : allFields,
      orderBy: sorts,
      skip,
      take,
      ...other,
    });
    const meta = await this.buildMetaData(take, query);
    return { meta, data };
  }

  async getAllByQuery(query: any = {}): Promise<any> {
    const data = await this.prismaService[this.entityModel].findMany({
      where: query,
    });

    return data;
  }

  async updateByQuery(query: any, data: any): Promise<any> {
    await this.prismaService[this.entityModel].updateMany({
      where: query,
      data,
    });

    return true;
  }

  async create(data: any, other: any = {}): Promise<any> {
    console.log(data);
    try {
      return await this.prismaService[this.entityModel].create({
        data,
        ...other,
      });
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async get(req: Request, id: any, other: any = {}): Promise<any> {
    const allFields = this.getAllFields();
    const rs = await this.prismaService[this.entityModel].findFirst({
      where: { ...req.query, id: id },
      select: allFields,
      ...other,
    });
    if (rs) return rs;
    throw new HttpException('Cannot find', HttpStatus.NOT_FOUND);
  }

  async update(
    query: any = {},
    id: any,
    data: any,
    other: any = {},
  ): Promise<any> {
    console.log('query: ', query);
    const rs = await this.prismaService[this.entityModel].updateMany({
      where: { ...query, id: id },
      data,
      ...other,
    });
    if (rs.count)
      return await this.prismaService[this.entityModel].findFirst({
        where: { id: id },
        ...other,
      });
    throw new HttpException('Cannot update', HttpStatus.NOT_FOUND);
  }

  async remove(req: Request, id: any, other: any = {}): Promise<any> {
    return await this.prismaService[this.entityModel].deleteMany({
      where: { ...req.query, id: id },
      ...other,
    });
  }

  async buildMetaData(size: number, query: any): Promise<any> {
    const count = await this.prismaService[this.entityModel].count({
      where: query,
    });
    return {
      count,
      totalPages: size > 0 ? Math.ceil(count / size) : 1,
    };
  }

  async upsert(
    query: any = {},
    create: any,
    update: any = {},
    other: any = {},
  ): Promise<any> {
    try {
      return await this.prismaService[this.entityModel].upsert({
        where: query,
        update: update,
        create: create,
        ...other,
      });
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  exportParams(req: Request): any {
    const params = req.query;
    let page = 0;
    let size = this.configService.get<number>('PERPAGE_DEFAULT', 20);
    let sorts = { id: 'desc' } as any;
    const select = {};
    if (params['fields']) {
      const fields = params['fields'] as string;
      for (const field of fields.split(',')) {
        select[field] = field;
      }
      delete params['fields'];
    }
    if ((params.page == '0' || params.page) && !isNaN(+params?.page)) {
      page = Math.max(0, +params.page);
      delete params['page'];
    }
    if (params.size && !isNaN(+params?.size)) {
      size = +params.size;
      delete params['size'];
    }

    if (params['sort_by']) {
      sorts = {} as any;
      let key = params.sort_by as string;
      const orderBy = (params?.order_by || '') as string;
      if (!this.fields[key]) {
        key = 'id';
      }
      sorts[key] = orderBy.toLowerCase() == 'desc' ? 'desc' : 'asc';
      delete params['sort_by'];
      delete params['order_by'];
    }

    const query = {} as any;

    const arrayFieldLike = [];
    for (const key in params) {
      if (!params[key] && params[key] != '0') {
        continue;
      }
      if (this.fields[key]) {
        if (
          ['Int', 'BigInt', 'Float', 'Decimal'].includes(this.fields[key].type)
        ) {
          query[key] = +params[key];
        } else {
          query[key] = params[key];
        }

        continue;
      }
      if (key.endsWith('_gte') && !isNaN(+params[key])) {
        const attr = key.replace('_gte', '');
        if (!this.fields[attr]) {
          continue;
        }
        if (this.fields[attr].type == 'String') {
          continue;
        }
        const type = typeof query[attr];
        if ((query[attr] || query[attr] == '0') && type != 'object') {
          continue;
        }

        query[attr] = { ...query[attr], gte: +params[key] };

        continue;
      }
      if (key.endsWith('_lte') && !isNaN(+params[key])) {
        const attr = key.replace('_lte', '');
        if (!this.fields[attr]) {
          continue;
        }
        if (this.fields[attr].type == 'String') {
          continue;
        }
        const type = typeof query[attr];
        if ((query[attr] || query[attr] == 0) && type != 'object') {
          continue;
        }
        query[attr] = { ...query[attr], lte: +params[key] };
        continue;
      }
      if (key.endsWith('_gt') && !isNaN(+params[key])) {
        const attr = key.replace('_gt', '');
        if (!this.fields[attr]) {
          continue;
        }
        if (this.fields[attr].type == 'String') {
          continue;
        }
        const type = typeof query[attr];
        if ((query[attr] || query[attr] == 0) && type != 'object') {
          continue;
        }
        query[attr] = { ...query[attr], gt: +params[key] };
        continue;
      }
      if (key.endsWith('_lt') && !isNaN(+params[key])) {
        const attr = key.replace('_lt', '');
        if (!this.fields[attr]) {
          continue;
        }
        if (this.fields[attr].type == 'String') {
          continue;
        }
        const type = typeof query[attr];
        if ((query[attr] || query[attr] == 0) && type != 'object') {
          continue;
        }
        query[attr] = { ...query[attr], lt: +params[key] };
        continue;
      }

      if (key.endsWith('_in')) {
        const attr = key.replace('_in', '');
        if (!this.fields[attr]) {
          continue;
        }
        const type = typeof query[attr];
        if ((query[attr] || query[attr] == 0) && type != 'object') {
          continue;
        }
        let values = ((params[key] as string) || '')
          .split(',')
          .filter((item: string) => item.trim().length > 0) as any;
        if (
          ['Int', 'BigInt', 'Float', 'Decimal'].includes(this.fields[attr].type)
        ) {
          values = values.map((item: string) => +item.trim());
        } else {
          values = values.map((item: string) => item.trim());
        }
        query[attr] = { in: values };
        continue;
      }

      if (key.endsWith('_notin')) {
        console.log();
        const attr = key.replace('_notin', '');
        if (!this.fields[attr]) {
          continue;
        }
        const type = typeof query[attr];
        if ((query[attr] || query[attr] == 0) && type != 'object') {
          continue;
        }
        let values = ((params[key] as string) || '')
          .split(',')
          .filter((item: string) => item.trim().length > 0) as any;
        if (
          ['Int', 'BigInt', 'Float', 'Decimal'].includes(this.fields[attr].type)
        ) {
          values = values.map((item: string) => +item.trim());
        } else {
          values = values.map((item: string) => item.trim());
        }
        query[attr] = { not: { in: values } };
        continue;
      }

      if (key.endsWith('_like')) {
        const attr = key.replace('_like', '');

        if (attr.includes('.')) {
          const [entity, childKey] = attr.split('.');

          if (!this.fields[entity]) {
            continue;
          }
          arrayFieldLike.push({
            [entity]: {
              [childKey]: { contains: params[key], mode: 'insensitive' },
            },
          });
          continue;
        }

        if (!this.fields[attr]) {
          continue;
        }
        const type = typeof query[attr];
        if (query[attr] && type != 'object') {
          continue;
        }
        arrayFieldLike.push({
          [attr]: { contains: params[key], mode: 'insensitive' },
        });
        continue;
      }

      if (key.endsWith('_has')) {
        const attr = key.replace('_has', '');
        if (!this.fields[attr]) {
          continue;
        }
        const type = typeof query[attr];
        if ((query[attr] || query[attr] == 0) && type != 'object') {
          continue;
        }
        query[attr] = { hasEvery: params[key] };
      }
    }

    if (arrayFieldLike.length) query['OR'] = arrayFieldLike;
    const skip = Math.max(Math.max(page - 1, 0) * size, 0);
    return { query, select, skip, take: size > 0 ? size : undefined, sorts };
  }

  getAllFields() {
    const allFields = {};
    for (const key of Object.keys(this.fields)) {
      allFields[key] = true;
    }
    return allFields;
  }
}
