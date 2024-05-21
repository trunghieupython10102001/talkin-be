export default class User {
  public id: string
  public readonly name: string
  public readonly avatar?: string

  constructor(id:string, name:string, avatar?: string) {
    this.id = id
    this.name = name
    this.avatar = avatar
  }
}
