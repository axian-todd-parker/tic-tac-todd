import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb'
import type { GameStore, StoredMultiplayerGame } from '../types.js'

export class DynamoGameStore implements GameStore {
  private readonly client: DynamoDBDocumentClient

  constructor(private readonly tableName: string, region?: string) {
    this.client = DynamoDBDocumentClient.from(new DynamoDBClient({ region }))
  }

  async countOpenGames() {
    const response = await this.client.send(
      new ScanCommand({
        TableName: this.tableName,
        ExpressionAttributeNames: {
          '#status': 'status',
        },
        ExpressionAttributeValues: {
          ':over': 'over',
        },
        FilterExpression: '#status <> :over',
        Select: 'COUNT',
      }),
    )

    return response.Count ?? 0
  }

  async createGame(game: StoredMultiplayerGame) {
    await this.saveGame(game)
  }

  async getGame(id: string) {
    const response = await this.client.send(
      new GetCommand({
        Key: { id },
        TableName: this.tableName,
      }),
    )

    return (response.Item as StoredMultiplayerGame | undefined) ?? null
  }

  async listGames(status?: StoredMultiplayerGame['status']) {
    const response = await this.client.send(
      new ScanCommand({
        TableName: this.tableName,
        ...(status
          ? {
              ExpressionAttributeNames: {
                '#status': 'status',
              },
              ExpressionAttributeValues: {
                ':status': status,
              },
              FilterExpression: '#status = :status',
            }
          : {}),
      }),
    )

    return ((response.Items as StoredMultiplayerGame[] | undefined) ?? []).sort((left, right) =>
      right.updatedAt.localeCompare(left.updatedAt),
    )
  }

  async saveGame(game: StoredMultiplayerGame) {
    await this.client.send(
      new PutCommand({
        Item: game,
        TableName: this.tableName,
      }),
    )
  }
}
