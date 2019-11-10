import { Resolver, Mutation, Args, Query, Context } from '@nestjs/graphql'
import { getMongoRepository } from 'typeorm'
import { createWriteStream } from 'fs'
import * as uuid from 'uuid'

import { File, User } from '@models'
import { uploadFile } from '@shared'
import { ApolloError } from 'apollo-server-core'

@Resolver('File')
export class FileResolver {
	@Query()
	async files(): Promise<File[]> {
		return getMongoRepository(File).find({
			cache: true
		})
	}

	@Query()
	async file(@Context('currentUser') currentUser: User) {
		const { _id } = currentUser
		if (_id) {
			return getMongoRepository(File).find({
				createdBy: _id
			})
		}
	}

	@Mutation()
	async uploadFile(
		@Args('file') file: any,
		@Context('currentUser') currentUser: User
	): Promise<File> {
		const { filename, createReadStream, mimetype } = file
		const { _id } = currentUser
		const path = await uploadFile(createReadStream)

		const newFile = await getMongoRepository(File).save(
			new File({ filename, path, createdBy: _id })
		)

		return newFile
	}

	@Mutation()
	async uploadFileLocal(
		@Args('file') file: any,
		@Context('req') req: any
	): Promise<File> {
		const { filename, createReadStream, mimetype } = file
		// console.log(req.headers.host)
		const convertFilename = `${uuid.v1()}.${mimetype.split('/')[1]}`
		let path
		await new Promise(res =>
			createReadStream(file).pipe(
				createWriteStream(`./uploads/${convertFilename}`)
					.on('error', err => {
						console.log('Error upload ', err)
						throw new ApolloError(err)
					})
					.on('finish', async () => {
						// console.log(
						// 	'Link',
						// 	`${req.headers.host}/uploads/${convertFilename}`
						// )

						path = `${req.headers.host}/uploads/${convertFilename}`

						return await getMongoRepository(File).save(
							new File({
								filename,
								path
							})
						)
					})
			)
		)

		const newFile = await getMongoRepository(File).save(
			new File({ filename, path })
		)

		return newFile
	}
}
